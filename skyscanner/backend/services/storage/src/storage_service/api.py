"""Routes under `/api/storage` (nginx forwards the full path). `path` is always the full bucket key."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse

from sky_core.api import require_permission
from sky_core.clock import utc_now
from sky_core.models.common import Artifact, OperationResult, UserContext
from sky_core.models.enums import ArtifactKind, Permission
from sky_core.models.storage import (
    ArchiveRequest,
    ArtifactUploadResponse,
    DownloadLinkResponse,
    StorageObjectResponse,
    UploadBeginRequest,
    UploadBeginResponse,
    UploadCompleteRequest,
    UploadDescriptor,
    UploadPart,
    UploadStatusResponse,
)
from sky_core.object_storage import DEFAULT_CONTENT_TYPE, content_disposition
from sky_core.text import safe_path_segment
from storage_service.http_rules import UnsatisfiableRange, preview_media_type, read_range
from storage_service.service import ArtifactService, UploadPayload

SERVICE_NAME = "storage-service"
SCRIPTLESS_POLICY = "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'"

Uploader = Annotated[UserContext, Depends(require_permission(Permission.FILE_UPLOAD))]
Downloader = Annotated[UserContext, Depends(require_permission(Permission.FILE_DOWNLOAD))]


def get_service(request: Request) -> ArtifactService:
    return ArtifactService(request.app.state.storage, request.app.state.storage_settings)


Service = Annotated[ArtifactService, Depends(get_service)]
ROUTER = APIRouter(prefix="/api/storage")


@ROUTER.get("/health", tags=["health"])
async def read_health(request: Request) -> dict[str, str]:
    reachable = await request.app.state.storage.ping()
    return {
        "service": SERVICE_NAME,
        "status": "healthy" if reachable else "degraded",
        "bucket": "up" if reachable else "down",
        "checked_at": utc_now().isoformat(),
    }


@ROUTER.post(
    "/artifacts", response_model=ArtifactUploadResponse, status_code=status.HTTP_201_CREATED, tags=["artifacts"]
)
async def upload_artifacts(
    service: Service,
    user: Uploader,
    files: Annotated[list[UploadFile], File(description="Files the user picked in the browser")],
    owner_kind: Annotated[str, Form()] = "events",
    owner_id: Annotated[str | None, Form()] = None,
    kind: Annotated[ArtifactKind, Form()] = ArtifactKind.ADDITIONAL,
    folder: Annotated[str | None, Form()] = None,
    descriptor: Annotated[str, Form()] = "",
) -> ArtifactUploadResponse:
    payloads = [
        UploadPayload(
            file_name=safe_path_segment(upload.filename or "unnamed"),
            read=upload.read,
            content_type=upload.content_type or DEFAULT_CONTENT_TYPE,
        )
        for upload in files
    ]
    target = UploadDescriptor(
        file_name="", owner_kind=owner_kind, owner_id=owner_id, kind=kind, folder=folder, descriptor=descriptor
    )
    return ArtifactUploadResponse(artifacts=await service.upload(payloads, target, user.username))


@ROUTER.post(
    "/artifacts/uploads", response_model=UploadBeginResponse, status_code=status.HTTP_201_CREATED, tags=["uploads"]
)
async def begin_upload(request: UploadBeginRequest, service: Service, _: Uploader) -> UploadBeginResponse:
    return await service.begin_upload(request)


@ROUTER.put("/artifacts/uploads/{upload_id}/parts/{number}", response_model=UploadPart, tags=["uploads"])
async def write_upload_part(
    upload_id: str, number: int, path: str, request: Request, service: Service, _: Uploader
) -> UploadPart:
    """The body is the raw bytes of the part; re-sending a number replaces that part (the retry mechanism)."""
    return await service.write_upload_part(path, upload_id, number, await request.body())


@ROUTER.get("/artifacts/uploads/{upload_id}", response_model=UploadStatusResponse, tags=["uploads"])
async def read_upload_status(upload_id: str, path: str, service: Service, _: Uploader) -> UploadStatusResponse:
    return await service.upload_status(path, upload_id)


@ROUTER.post("/artifacts/uploads/{upload_id}/complete", response_model=Artifact, tags=["uploads"])
async def complete_upload(upload_id: str, request: UploadCompleteRequest, service: Service, user: Uploader) -> Artifact:
    return await service.complete_upload(upload_id, request, user.username)


@ROUTER.delete("/artifacts/uploads/{upload_id}", response_model=OperationResult, tags=["uploads"])
async def abort_upload(upload_id: str, path: str, service: Service, _: Uploader) -> OperationResult:
    await service.abort_upload(path, upload_id)
    return OperationResult(message="The upload was given up", affected=1)


@ROUTER.get("/artifacts/link", response_model=DownloadLinkResponse, tags=["artifacts"])
async def read_download_link(
    path: str, service: Service, _: Downloader, name: str | None = None
) -> DownloadLinkResponse:
    return await service.download_link(path, name)


@ROUTER.get("/artifacts/metadata", response_model=StorageObjectResponse, tags=["artifacts"])
async def read_metadata(path: str, service: Service, _: Downloader) -> StorageObjectResponse:
    return await service.describe(path)


@ROUTER.get("/artifacts/content", tags=["artifacts"], response_model=None)
async def read_content(
    path: str,
    service: Service,
    _: Downloader,
    inline: bool = False,
    name: str | None = None,
    range_header: Annotated[str | None, Header(alias="Range")] = None,
) -> Response:
    """The file, or one byte range of it (206); a range past the end answers 416."""
    metadata = await service.describe(path)
    file_name = safe_path_segment(name) if name else path.rsplit("/", maxsplit=1)[-1]
    media_type = preview_media_type(metadata.content_type, file_name) if inline else metadata.content_type
    headers = {
        "Content-Disposition": content_disposition("inline" if inline else "attachment", file_name),
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
    }
    if media_type.split(";", maxsplit=1)[0].strip().lower() == "image/svg+xml":
        headers["Content-Security-Policy"] = SCRIPTLESS_POLICY
    try:
        window = read_range(range_header, metadata.size_bytes)
    except UnsatisfiableRange:
        unsatisfiable = {**headers, "Content-Range": f"bytes */{metadata.size_bytes}"}
        return Response(status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE, headers=unsatisfiable)
    if window is None:
        return StreamingResponse(service.stream(path), media_type=media_type, headers=headers)
    headers["Content-Range"] = f"bytes {window.start}-{window.end}/{metadata.size_bytes}"
    headers["Content-Length"] = str(window.length)
    return StreamingResponse(
        service.stream(path, window.start, window.end),
        media_type=media_type,
        headers=headers,
        status_code=status.HTTP_206_PARTIAL_CONTENT,
    )


@ROUTER.post("/artifacts/archive", tags=["artifacts"])
async def download_archive(request: ArchiveRequest, service: Service, _: Downloader) -> StreamingResponse:
    return StreamingResponse(
        service.build_archive(request),
        media_type="application/zip",
        headers={"Content-Disposition": content_disposition("attachment", request.archive_name)},
    )


@ROUTER.delete("/artifacts", response_model=OperationResult, tags=["artifacts"])
async def delete_artifact(path: str, service: Service, _: Uploader) -> OperationResult:
    """Deleting a key that is not stored succeeds too."""
    await service.delete(path)
    return OperationResult(message="The file was removed", affected=1)
