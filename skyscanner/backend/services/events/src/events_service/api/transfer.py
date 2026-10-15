"""Exports (CSV/JSON files, file archive and bundle manifests) and the bundle import."""

from typing import Annotated, Any

from fastapi import APIRouter, File, UploadFile, status
from fastapi.responses import StreamingResponse

from events_service.api.deps import Downloader, EventCreator, Reader
from events_service.services.bundles import MAX_BUNDLE_BYTES
from events_service.wiring import Services
from sky_core.errors import ValidationError
from sky_core.models.grid import EventExportRequest
from sky_core.models.storage import ArchiveRequest
from sky_core.object_storage import content_disposition

ROUTER = APIRouter()


@ROUTER.post("/exports/events", tags=["exports"])
async def export_events(
    request: EventExportRequest,
    services: Services,
    _: Reader,
    export_format: str = "csv",
    entity_mode: str = "summary",
) -> StreamingResponse:
    exported = services.exports.export_events(request, export_format, entity_mode)
    return StreamingResponse(
        exported.body,
        media_type=exported.media_type,
        headers={"Content-Disposition": content_disposition("attachment", exported.file_name)},
    )


@ROUTER.post("/exports/events/bundle", response_model=ArchiveRequest, tags=["exports"])
async def build_bundle_manifest(request: EventExportRequest, services: Services, _: Downloader) -> ArchiveRequest:
    return await services.bundles.build_bundle(request)


@ROUTER.post("/exports/events/files", response_model=ArchiveRequest, tags=["exports"])
async def build_file_archive_manifest(request: EventExportRequest, services: Services, _: Downloader) -> ArchiveRequest:
    return await services.exports.build_archive_manifest(request)


@ROUTER.post("/imports/events", status_code=status.HTTP_201_CREATED, tags=["imports"])
async def import_events(
    services: Services,
    user: EventCreator,
    file: Annotated[UploadFile, File(description="The bundle written by the bundle export")],
) -> dict[str, Any]:
    payload = await file.read()
    if len(payload) > MAX_BUNDLE_BYTES:
        raise ValidationError(
            "The bundle is larger than one import may carry",
            {"size_bytes": str(len(payload)), "limit_bytes": str(MAX_BUNDLE_BYTES)},
        )
    try:
        return await services.bundles.restore_bundle(payload, user)
    except ValueError as error:
        raise ValidationError(str(error)) from error
