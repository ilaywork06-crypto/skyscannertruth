"""Async S3 client for the bucket holding every file of the inventory.

Behaviour the services (and existing data) rely on:
- Streams up to `S3_MULTIPART_THRESHOLD_BYTES` go up in one PUT; larger ones as a multipart upload whose parts are
  `max(S3_MULTIPART_CHUNK_BYTES, 5 MiB)` long and sent in waves of `S3_MULTIPART_CONCURRENCY` (a wave is awaited before
  more is read, which bounds memory). Any failure aborts the multipart upload.
- Browser-driven multipart (`begin_multipart` / `write_part` / `stored_parts` / `complete_multipart`) is stateless:
  the bucket is the only record of an open upload.
- Temporary links are signed against `S3_PUBLIC_ENDPOINT_URL` when it is set, so a browser can follow them.
- Metadata values are made ASCII (`ascii_metadata_value`), file names in headers follow RFC 5987.
"""

import asyncio
import re
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import AsyncExitStack
from datetime import timedelta
from typing import Any
from urllib.parse import quote

import aioboto3
from botocore.exceptions import BotoCoreError, ClientError

from sky_core.clock import utc_now
from sky_core.errors import NotFoundError, StorageError
from sky_core.log import get_logger
from sky_core.settings import StorageSettings
from sky_core.text import ascii_metadata_value, safe_path_segment

LOGGER = get_logger(__name__)

DEFAULT_CONTENT_TYPE = "application/octet-stream"
STREAM_CHUNK_SIZE = 1024 * 1024
MINIMUM_PART_BYTES = 5 * 1024 * 1024
MAXIMUM_PARTS = 10_000
_NOT_FOUND_CODES = frozenset({"404", "NoSuchKey", "NoSuchBucket", "NotFound"})
_UNSAFE_HEADER_CHARACTERS = re.compile(r'[^\x20-\x7e]|["\\]')

ChunkReader = Callable[[int], Awaitable[bytes]]
"""Reads at most n bytes; `b""` at the end (the shape of `UploadFile.read`)."""


class ObjectStorageClient:
    """One per process; `start()` connects and makes sure the bucket exists."""

    def __init__(self, settings: StorageSettings) -> None:
        self._settings = settings
        self._exit_stack = AsyncExitStack()
        self._client: Any = None
        self._signer: Any = None

    @property
    def part_size(self) -> int:
        return max(self._settings.multipart_chunk_bytes, MINIMUM_PART_BYTES)

    async def start(self) -> None:
        if self._client is not None:
            return
        session = aioboto3.Session(
            aws_access_key_id=self._settings.access_key_id,
            aws_secret_access_key=self._settings.secret_access_key,
            region_name=self._settings.region,
        )
        try:
            self._client = await self._open(session, self._settings.endpoint_url)
            public = self._settings.public_endpoint_url
            self._signer = await self._open(session, public) if public else self._client
            await self._ensure_bucket()
        except (BotoCoreError, ClientError) as error:
            await self.stop()
            raise StorageError("The object storage could not be reached", {"bucket": self._settings.bucket}) from error
        LOGGER.info("Connected to the object storage bucket %s", self._settings.bucket)

    async def _open(self, session: Any, endpoint_url: str | None) -> Any:
        client = session.client("s3", endpoint_url=endpoint_url, verify=self._settings.verify_tls)
        return await self._exit_stack.enter_async_context(client)

    async def stop(self) -> None:
        await self._exit_stack.aclose()
        self._exit_stack = AsyncExitStack()
        self._client = None
        self._signer = None

    async def ping(self) -> bool:
        if self._client is None:
            return False
        try:
            await self._client.head_bucket(Bucket=self._settings.bucket)
        except (BotoCoreError, ClientError):
            return False
        return True

    # ----- writing ----- #

    async def upload(
        self,
        path: str,
        payload: bytes,
        content_type: str = DEFAULT_CONTENT_TYPE,
        metadata: dict[str, str] | None = None,
    ) -> str:
        """One PUT; returns the ETag without quotes."""
        try:
            response = await self._require_client().put_object(
                Bucket=self._settings.bucket,
                Key=path,
                Body=payload,
                ContentType=content_type,
                Metadata=_encode_metadata(metadata),
            )
        except (BotoCoreError, ClientError) as error:
            raise StorageError("The file could not be written", {"path": path}) from error
        return str(response.get("ETag", "")).strip('"')

    async def upload_stream(
        self,
        path: str,
        reader: ChunkReader,
        content_type: str = DEFAULT_CONTENT_TYPE,
        metadata: dict[str, str] | None = None,
    ) -> tuple[str, int]:
        """Writes everything `reader` yields; returns `(etag, bytes written)`."""
        threshold = self._settings.multipart_threshold_bytes
        head = await _read_up_to(reader, threshold + 1)
        if len(head) <= threshold:
            return await self.upload(path, head, content_type, metadata), len(head)
        return await self._upload_multipart(path, head, reader, content_type, metadata)

    async def _upload_multipart(
        self, path: str, buffered: bytes, reader: ChunkReader, content_type: str, metadata: dict[str, str] | None
    ) -> tuple[str, int]:
        upload_id = await self._create_multipart(path, content_type, metadata, "The file could not be written")
        written = 0
        parts: list[dict[str, Any]] = []
        in_flight: list[asyncio.Task[dict[str, Any]]] = []
        try:
            async for number, chunk in _numbered_parts(buffered, reader, self.part_size):
                written += len(chunk)
                in_flight.append(asyncio.ensure_future(self._upload_part(path, upload_id, number, chunk)))
                if len(in_flight) >= self._settings.multipart_concurrency:
                    parts.extend(await asyncio.gather(*in_flight))
                    in_flight = []
            parts.extend(await asyncio.gather(*in_flight))
            in_flight = []
            parts.sort(key=lambda part: int(part["PartNumber"]))
            completed = await self._require_client().complete_multipart_upload(
                Bucket=self._settings.bucket, Key=path, UploadId=upload_id, MultipartUpload={"Parts": parts}
            )
        except (BotoCoreError, ClientError, StorageError) as error:
            for task in in_flight:
                task.cancel()
            await self.abort_multipart(path, upload_id)
            raise StorageError("The file could not be written", {"path": path}) from error
        LOGGER.info("Wrote %s to the bucket as %d parts", path, len(parts))
        return str(completed.get("ETag", "")).strip('"'), written

    async def _create_multipart(
        self, path: str, content_type: str, metadata: dict[str, str] | None, failure: str
    ) -> str:
        try:
            started = await self._require_client().create_multipart_upload(
                Bucket=self._settings.bucket, Key=path, ContentType=content_type, Metadata=_encode_metadata(metadata)
            )
        except (BotoCoreError, ClientError) as error:
            raise StorageError(failure, {"path": path}) from error
        return str(started["UploadId"])

    async def _upload_part(self, path: str, upload_id: str, number: int, chunk: bytes) -> dict[str, Any]:
        try:
            response = await self._require_client().upload_part(
                Bucket=self._settings.bucket, Key=path, UploadId=upload_id, PartNumber=number, Body=chunk
            )
        except (BotoCoreError, ClientError) as error:
            raise StorageError("The file could not be written", {"path": path, "part": str(number)}) from error
        return {"PartNumber": number, "ETag": response["ETag"]}

    # ----- browser driven multipart ----- #

    async def begin_multipart(
        self, path: str, content_type: str = DEFAULT_CONTENT_TYPE, metadata: dict[str, str] | None = None
    ) -> str:
        return await self._create_multipart(path, content_type, metadata, "The upload could not be started")

    async def write_part(self, path: str, upload_id: str, number: int, chunk: bytes) -> str:
        written = await self._upload_part(path, upload_id, number, chunk)
        return str(written["ETag"]).strip('"')

    async def stored_parts(self, path: str, upload_id: str) -> list[tuple[int, str, int]]:
        """`(number, etag, size)` of every part the bucket holds, sorted by number."""
        parts: list[tuple[int, str, int]] = []
        marker = 0
        try:
            while True:
                answer = await self._require_client().list_parts(
                    Bucket=self._settings.bucket, Key=path, UploadId=upload_id, PartNumberMarker=marker
                )
                parts.extend(
                    (int(part["PartNumber"]), str(part["ETag"]).strip('"'), int(part.get("Size", 0)))
                    for part in answer.get("Parts", [])
                )
                if not answer.get("IsTruncated", False):
                    break
                marker = int(answer.get("NextPartNumberMarker", 0))
        except ClientError as error:
            if _is_missing(error) or _error_code(error) == "NoSuchUpload":
                raise NotFoundError("The upload is not open", {"path": path, "upload_id": upload_id}) from error
            raise StorageError("The upload could not be read", {"path": path}) from error
        except BotoCoreError as error:
            raise StorageError("The upload could not be read", {"path": path}) from error
        return sorted(parts)

    async def complete_multipart(self, path: str, upload_id: str, parts: list[tuple[int, str]]) -> str:
        ordered = sorted(parts, key=lambda part: part[0])
        try:
            completed = await self._require_client().complete_multipart_upload(
                Bucket=self._settings.bucket,
                Key=path,
                UploadId=upload_id,
                MultipartUpload={"Parts": [{"PartNumber": number, "ETag": tag} for number, tag in ordered]},
            )
        except (BotoCoreError, ClientError) as error:
            raise StorageError("The upload could not be finished", {"path": path}) from error
        LOGGER.info("Finished the caller driven upload of %s as %d parts", path, len(ordered))
        return str(completed.get("ETag", "")).strip('"')

    async def abort_multipart(self, path: str, upload_id: str) -> None:
        """Best effort: a failure is logged and swallowed."""
        try:
            await self._require_client().abort_multipart_upload(
                Bucket=self._settings.bucket, Key=path, UploadId=upload_id
            )
        except (BotoCoreError, ClientError, StorageError):
            LOGGER.warning("The unfinished upload of %s could not be given up", path)

    # ----- reading ----- #

    async def download(self, path: str) -> bytes:
        chunks = [chunk async for chunk in self.stream(path)]
        return b"".join(chunks)

    async def stream(self, path: str, start: int | None = None, end: int | None = None) -> AsyncIterator[bytes]:
        """Yields 1 MiB chunks of the object, or of the inclusive byte window `start..end`."""
        arguments: dict[str, Any] = {"Bucket": self._settings.bucket, "Key": path}
        window = _byte_range(start, end)
        if window is not None:
            arguments["Range"] = window
        try:
            response = await self._require_client().get_object(**arguments)
        except ClientError as error:
            if _is_missing(error):
                raise NotFoundError("The file is not stored", {"path": path}) from error
            raise StorageError("The file could not be read", {"path": path}) from error
        except BotoCoreError as error:
            raise StorageError("The file could not be read", {"path": path}) from error
        body = response["Body"]
        while chunk := await body.read(STREAM_CHUNK_SIZE):
            yield chunk

    async def head(self, path: str) -> dict[str, Any]:
        try:
            response: dict[str, Any] = await self._require_client().head_object(Bucket=self._settings.bucket, Key=path)
        except ClientError as error:
            if _is_missing(error):
                raise NotFoundError("The file is not stored", {"path": path}) from error
            raise StorageError("The file could not be inspected", {"path": path}) from error
        except BotoCoreError as error:
            raise StorageError("The file could not be inspected", {"path": path}) from error
        return response

    async def delete(self, path: str) -> None:
        try:
            await self._require_client().delete_object(Bucket=self._settings.bucket, Key=path)
        except (BotoCoreError, ClientError) as error:
            raise StorageError("The file could not be removed", {"path": path}) from error

    async def presigned_url(
        self, path: str, file_name: str | None = None, inline: bool = False
    ) -> tuple[str, timedelta]:
        """A temporary GET link, signed against the public endpoint when one is configured."""
        self._require_client()
        parameters: dict[str, str] = {"Bucket": self._settings.bucket, "Key": path}
        if file_name is not None:
            parameters["ResponseContentDisposition"] = content_disposition(
                "inline" if inline else "attachment", file_name
            )
        ttl = self._settings.presigned_url_ttl_seconds
        try:
            url: str = await self._signer.generate_presigned_url(
                ClientMethod="get_object", Params=parameters, ExpiresIn=ttl
            )
        except (BotoCoreError, ClientError) as error:
            raise StorageError("The download link could not be created", {"path": path}) from error
        return url, timedelta(seconds=ttl)

    async def _ensure_bucket(self) -> None:
        client = self._require_client()
        try:
            await client.head_bucket(Bucket=self._settings.bucket)
        except ClientError as error:
            if not _is_missing(error):
                raise
            await client.create_bucket(Bucket=self._settings.bucket)
            LOGGER.info("Created the object storage bucket %s", self._settings.bucket)

    def _require_client(self) -> Any:
        if self._client is None:
            raise StorageError("The object storage client was used before it was started")
        return self._client


def build_object_key(prefix: str, identifier: str, file_name: str) -> str:
    """`{prefix}/{identifier}/{YYYY}/{MM}/{DD}/{safe file name}` with today's UTC date."""
    return f"{prefix}/{identifier}/{utc_now().strftime('%Y/%m/%d')}/{safe_path_segment(file_name)}"


def content_disposition(disposition: str, file_name: str) -> str:
    """An ASCII fallback name plus the exact UTF-8 name (RFC 5987)."""
    fallback = _UNSAFE_HEADER_CHARACTERS.sub("_", file_name).strip() or "download"
    return f"{disposition}; filename=\"{fallback}\"; filename*=UTF-8''{quote(file_name, safe='')}"


async def _read_up_to(reader: ChunkReader, amount: int) -> bytes:
    collected = bytearray()
    while len(collected) < amount:
        block = await reader(amount - len(collected))
        if not block:
            break
        collected.extend(block)
    return bytes(collected)


async def _numbered_parts(buffered: bytes, reader: ChunkReader, part_size: int) -> AsyncIterator[tuple[int, bytes]]:
    pending = bytearray(buffered)
    number = 0
    exhausted = False
    while True:
        while not exhausted and len(pending) < part_size:
            block = await reader(part_size)
            if not block:
                exhausted = True
                break
            pending.extend(block)
        if not pending:
            return
        number += 1
        if number > MAXIMUM_PARTS:
            raise StorageError("The file is too large to be written in one upload", {"parts": str(MAXIMUM_PARTS)})
        yield number, bytes(pending[:part_size])
        del pending[:part_size]


def _encode_metadata(metadata: dict[str, str] | None) -> dict[str, str]:
    return {key: ascii_metadata_value(value) for key, value in (metadata or {}).items()}


def _byte_range(start: int | None, end: int | None) -> str | None:
    if start is None and end is None:
        return None
    if start is None:
        return f"bytes=-{end}"
    return f"bytes={start}-" if end is None else f"bytes={start}-{end}"


def _error_code(error: ClientError) -> str:
    return str(error.response.get("Error", {}).get("Code", ""))


def _is_missing(error: ClientError) -> bool:
    status = str(error.response.get("ResponseMetadata", {}).get("HTTPStatusCode", ""))
    return _error_code(error) in _NOT_FOUND_CODES or status == "404"
