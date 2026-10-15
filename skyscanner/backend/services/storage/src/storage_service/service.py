"""Storage use cases on top of the object storage client.

Keys are `{owner_kind}/{owner_id or "unassigned"}/{YYYY}/{MM}/{DD}/{uuid}_{file name}`: a fresh uuid means an upload
never overwrites another file. Object metadata records `original_name` and `kind`.
"""

import asyncio
import tempfile
import zipfile
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from datetime import timedelta
from typing import IO
from urllib.parse import urlencode

from sky_core.clock import utc_now
from sky_core.errors import NotFoundError, ValidationError
from sky_core.ids import new_id
from sky_core.log import get_logger
from sky_core.models.common import Artifact
from sky_core.models.storage import (
    ArchiveRequest,
    DownloadLinkResponse,
    StorageObjectResponse,
    UploadBeginRequest,
    UploadBeginResponse,
    UploadCompleteRequest,
    UploadDescriptor,
    UploadPart,
    UploadStatusResponse,
)
from sky_core.object_storage import (
    DEFAULT_CONTENT_TYPE,
    MAXIMUM_PARTS,
    STREAM_CHUNK_SIZE,
    ObjectStorageClient,
    build_object_key,
)
from sky_core.settings import StorageSettings
from sky_core.text import file_suffix

from storage_service.http_rules import archive_entry

LOGGER = get_logger(__name__)
UNKNOWN_OWNER = "unassigned"
ARCHIVE_SPOOL_BYTES = 64 * 1024 * 1024
CONTENT_PATH = "/api/storage/artifacts/content"


@dataclass(frozen=True)
class UploadPayload:
    file_name: str
    read: Callable[[int], Awaitable[bytes]]
    content_type: str


class ArtifactService:
    def __init__(self, storage: ObjectStorageClient, settings: StorageSettings) -> None:
        self._storage = storage
        self._settings = settings

    async def upload(
        self,
        payloads: list[UploadPayload],
        descriptor: UploadDescriptor,
        uploaded_by: str,
    ) -> list[Artifact]:
        """Writes the files concurrently (bounded); one failure fails the whole request."""
        gate = asyncio.Semaphore(self._settings.upload_concurrency)

        async def write_one(payload: UploadPayload) -> Artifact:
            async with gate:
                return await self._write_one(payload, descriptor, uploaded_by)

        return list(await asyncio.gather(*(write_one(payload) for payload in payloads)))

    async def _write_one(self, payload: UploadPayload, descriptor: UploadDescriptor, uploaded_by: str) -> Artifact:
        path = _object_key(descriptor, payload.file_name)
        metadata = {"original_name": payload.file_name, "kind": descriptor.kind.value}
        checksum, size = await self._storage.upload_stream(path, payload.read, payload.content_type, metadata)
        return _artifact(descriptor, payload.file_name, path, size, payload.content_type, checksum, uploaded_by)

    async def begin_upload(self, request: UploadBeginRequest) -> UploadBeginResponse:
        path = _object_key(request, request.file_name)
        metadata = {"original_name": request.file_name, "kind": request.kind.value}
        upload_id = await self._storage.begin_multipart(path, request.content_type or DEFAULT_CONTENT_TYPE, metadata)
        return UploadBeginResponse(
            upload_id=upload_id, path=path, part_size=self._storage.part_size, max_parts=MAXIMUM_PARTS
        )

    async def write_upload_part(self, path: str, upload_id: str, number: int, chunk: bytes) -> UploadPart:
        if number < 1 or number > MAXIMUM_PARTS:
            raise ValidationError(
                "The part is numbered outside the upload", {"part": str(number), "most": str(MAXIMUM_PARTS)}
            )
        etag = await self._storage.write_part(path, upload_id, number, chunk)
        return UploadPart(number=number, etag=etag, size_bytes=len(chunk))

    async def upload_status(self, path: str, upload_id: str) -> UploadStatusResponse:
        parts = await self._storage.stored_parts(path, upload_id)
        return UploadStatusResponse(
            upload_id=upload_id,
            path=path,
            parts=[UploadPart(number=number, etag=etag, size_bytes=size) for number, etag, size in parts],
        )

    async def complete_upload(self, upload_id: str, request: UploadCompleteRequest, uploaded_by: str) -> Artifact:
        if not request.parts:
            raise ValidationError("The upload carries no parts", {"upload_id": upload_id, "path": request.path})
        checksum = await self._storage.complete_multipart(
            request.path, upload_id, [(part.number, part.etag) for part in request.parts]
        )
        size = int((await self._storage.head(request.path)).get("ContentLength") or 0)
        content_type = request.content_type or DEFAULT_CONTENT_TYPE
        return _artifact(request, request.file_name, request.path, size, content_type, checksum, uploaded_by)

    async def abort_upload(self, path: str, upload_id: str) -> None:
        await self._storage.abort_multipart(path, upload_id)

    async def describe(self, path: str) -> StorageObjectResponse:
        head = await self._storage.head(path)
        etag = head.get("ETag")
        return StorageObjectResponse(
            path=path,
            size_bytes=int(head.get("ContentLength") or 0),
            content_type=str(head.get("ContentType") or DEFAULT_CONTENT_TYPE),
            checksum=str(etag).strip('"') if etag else None,
            last_modified=head.get("LastModified"),
        )

    async def download_link(self, path: str, name: str | None) -> DownloadLinkResponse:
        """A presigned link when a public bucket endpoint is configured, else a link through this service."""
        metadata = await self.describe(path)
        file_name = name or path.rsplit("/", maxsplit=1)[-1]
        if self._settings.public_endpoint_url:
            url, ttl = await self._storage.presigned_url(path, file_name)
        else:
            url = f"{CONTENT_PATH}?{urlencode({'path': path, 'name': file_name})}"
            ttl = timedelta(seconds=self._settings.presigned_url_ttl_seconds)
        return DownloadLinkResponse(
            url=url, name=file_name, content_type=metadata.content_type, expires_at=utc_now() + ttl
        )

    def stream(self, path: str, start: int | None = None, end: int | None = None) -> AsyncIterator[bytes]:
        return self._storage.stream(path, start, end)

    async def delete(self, path: str) -> None:
        await self._storage.delete(path)

    async def build_archive(self, request: ArchiveRequest) -> AsyncIterator[bytes]:
        """The whole zip is built in a spooled temporary file (memory up to 64 MiB), then streamed. Caller documents
        come first; stored files missing from the bucket are left out."""
        with tempfile.SpooledTemporaryFile(max_size=ARCHIVE_SPOOL_BYTES) as spool:
            await self._write_archive(request, spool)
            spool.seek(0)
            while chunk := spool.read(STREAM_CHUNK_SIZE):
                yield chunk

    async def _write_archive(self, request: ArchiveRequest, spool: IO[bytes]) -> None:
        taken: set[str] = set()
        with zipfile.ZipFile(spool, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for document in request.documents:
                archive.writestr(archive_entry(document.entry, taken), document.content)
            for item in request.entries:
                await self._write_entry(archive, item.path, archive_entry(item.entry, taken))

    async def _write_entry(self, archive: zipfile.ZipFile, path: str, entry: str) -> None:
        chunks = self._storage.stream(path)
        try:
            first = await anext(chunks, None)
        except NotFoundError:
            LOGGER.warning("The bucket no longer holds %s, leaving it out of the archive", path)
            return
        with archive.open(entry, "w") as target:
            if first is not None:
                target.write(first)
            async for chunk in chunks:
                target.write(chunk)


def _object_key(descriptor: UploadDescriptor, file_name: str) -> str:
    return build_object_key(descriptor.owner_kind, descriptor.owner_id or UNKNOWN_OWNER, f"{new_id()}_{file_name}")


def _artifact(
    descriptor: UploadDescriptor,
    file_name: str,
    path: str,
    size: int,
    content_type: str,
    checksum: str,
    uploaded_by: str,
) -> Artifact:
    return Artifact(
        id=new_id(),
        name=file_name,
        path=path,
        descriptor=descriptor.descriptor,
        kind=descriptor.kind,
        suffix=file_suffix(file_name),
        folder=descriptor.folder,
        source=f"upload://{descriptor.owner_kind}/{descriptor.owner_id or UNKNOWN_OWNER}",
        size_bytes=size,
        content_type=content_type,
        checksum=checksum,
        uploaded_by=uploaded_by,
        created_at=utc_now(),
    )
