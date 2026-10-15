"""The dynamic schema: fields, event/entity types (with the deprecated platform aliases), platforms, industries.

Addressing is mixed on purpose (compatibility): industries by key; platforms read by key and changed by id; types
and fields by id. Route order matters where paths overlap (`/types/platforms/{id}` before `/types/events/{id}`).
"""

from fastapi import APIRouter, status

from events_service.api.deps import IndustryManager, Limit, Offset, Reader, SchemaManager
from events_service.wiring import Services
from sky_core.models.common import OperationResult, RenameResult
from sky_core.models.entity import EntityTypeCreateRequest, EntityTypeResponse, EntityTypeUpdateRequest
from sky_core.models.enums import FieldScope
from sky_core.models.event import EventTypeCreateRequest, EventTypeResponse, EventTypeUpdateRequest
from sky_core.models.field import FieldCreateRequest, FieldResponse, FieldUpdateRequest
from sky_core.models.industry import IndustryCreateRequest, IndustryResponse, IndustryUpdateRequest
from sky_core.models.platform import PlatformCreateRequest, PlatformResponse, PlatformUpdateRequest

ROUTER = APIRouter()
CREATED = status.HTTP_201_CREATED

# ----- fields ----- #


@ROUTER.get("/fields", response_model=list[FieldResponse], tags=["fields"])
async def list_fields(
    services: Services,
    _: Reader,
    scope: FieldScope = FieldScope.EVENT,
    industry: str | None = None,
    entity_type: str | None = None,
    include_shared: bool = True,
    additional: bool | None = None,
    offset: Offset = 0,
    limit: Limit = 0,
) -> list[FieldResponse]:
    return await services.fields.list_fields(scope, industry, entity_type, include_shared, additional, offset, limit)


@ROUTER.post("/fields", response_model=FieldResponse, status_code=CREATED, tags=["fields"])
async def create_field(request: FieldCreateRequest, services: Services, user: SchemaManager) -> FieldResponse:
    return await services.fields.create_field(request, user)


@ROUTER.get("/fields/{field_id}/rename", response_model=RenameResult, tags=["fields"])
async def preview_field_rename(field_id: str, key: str, services: Services, _: SchemaManager) -> RenameResult:
    return await services.fields.preview_rename(field_id, key)


@ROUTER.patch("/fields/{field_id}", response_model=FieldResponse, tags=["fields"])
async def update_field(
    field_id: str, request: FieldUpdateRequest, services: Services, _: SchemaManager
) -> FieldResponse:
    return await services.fields.update_field(field_id, request)


@ROUTER.delete("/fields/{field_id}", response_model=OperationResult, tags=["fields"])
async def delete_field(field_id: str, services: Services, user: SchemaManager) -> OperationResult:
    await services.fields.delete_field(field_id, user)
    return OperationResult(message="The field declaration was removed", affected=1)


# ----- types ----- #


@ROUTER.get("/types/events", response_model=list[EventTypeResponse], tags=["types"])
async def list_event_types(
    services: Services, _: Reader, industry: str | None = None, offset: Offset = 0, limit: Limit = 0
) -> list[EventTypeResponse]:
    return await services.types.list_event_types(industry, offset, limit)


@ROUTER.get("/types/entities", response_model=list[EntityTypeResponse], tags=["types"])
async def list_entity_types(
    services: Services, _: Reader, industry: str | None = None, offset: Offset = 0, limit: Limit = 0
) -> list[EntityTypeResponse]:
    return await services.types.list_entity_types(industry, offset, limit)


@ROUTER.get("/types/platforms", response_model=list[PlatformResponse], deprecated=True, tags=["types"])
async def list_platforms_legacy(
    services: Services, _: Reader, industry: str | None = None, offset: Offset = 0, limit: Limit = 0
) -> list[PlatformResponse]:
    return await services.platforms.list_platforms(industry, offset, limit)


@ROUTER.post("/types/events", response_model=EventTypeResponse, status_code=CREATED, tags=["types"])
async def create_event_type(request: EventTypeCreateRequest, services: Services, _: SchemaManager) -> EventTypeResponse:
    return await services.types.create_event_type(request)


@ROUTER.post("/types/entities", response_model=EntityTypeResponse, status_code=CREATED, tags=["types"])
async def create_entity_type(
    request: EntityTypeCreateRequest, services: Services, _: SchemaManager
) -> EntityTypeResponse:
    return await services.types.create_entity_type(request)


@ROUTER.post("/types/platforms", response_model=PlatformResponse, status_code=CREATED, deprecated=True, tags=["types"])
async def create_platform_legacy(
    request: PlatformCreateRequest, services: Services, _: SchemaManager
) -> PlatformResponse:
    return await services.platforms.create_platform(request)


@ROUTER.patch("/types/platforms/{type_id}", response_model=PlatformResponse, deprecated=True, tags=["types"])
async def update_platform_legacy(
    type_id: str, request: PlatformUpdateRequest, services: Services, _: SchemaManager
) -> PlatformResponse:
    return await services.platforms.update_platform(type_id, request)


@ROUTER.get("/types/{type_id}/rename", response_model=RenameResult, tags=["types"])
async def preview_type_rename(type_id: str, key: str, services: Services, _: SchemaManager) -> RenameResult:
    return await services.types.preview_rename(type_id, key)


@ROUTER.patch("/types/events/{type_id}", response_model=EventTypeResponse, tags=["types"])
async def update_event_type(
    type_id: str, request: EventTypeUpdateRequest, services: Services, _: SchemaManager
) -> EventTypeResponse:
    return await services.types.update_event_type(type_id, request)


@ROUTER.patch("/types/entities/{type_id}", response_model=EntityTypeResponse, tags=["types"])
async def update_entity_type(
    type_id: str, request: EntityTypeUpdateRequest, services: Services, _: SchemaManager
) -> EntityTypeResponse:
    return await services.types.update_entity_type(type_id, request)


@ROUTER.delete("/types/{type_id}", response_model=OperationResult, tags=["types"])
async def delete_type(type_id: str, services: Services, user: SchemaManager) -> OperationResult:
    await services.types.delete_type(type_id, user)
    return OperationResult(message="The type was removed", affected=1)


# ----- industries ----- #


@ROUTER.get("/industries", response_model=list[IndustryResponse], tags=["industries"])
async def list_industries(
    services: Services, _: Reader, offset: Offset = 0, limit: Limit = 0
) -> list[IndustryResponse]:
    return await services.industries.list_industries(offset, limit)


@ROUTER.get("/industries/{key}", response_model=IndustryResponse, tags=["industries"])
async def read_industry(key: str, services: Services, _: Reader) -> IndustryResponse:
    return await services.industries.get_industry(key)


@ROUTER.post("/industries", response_model=IndustryResponse, status_code=CREATED, tags=["industries"])
async def create_industry(request: IndustryCreateRequest, services: Services, _: IndustryManager) -> IndustryResponse:
    return await services.industries.create_industry(request)


@ROUTER.patch("/industries/{key}", response_model=IndustryResponse, tags=["industries"])
async def update_industry(
    key: str, request: IndustryUpdateRequest, services: Services, _: IndustryManager
) -> IndustryResponse:
    return await services.industries.update_industry(key, request)


# ----- platforms ----- #


@ROUTER.get("/platforms", response_model=list[PlatformResponse], tags=["platforms"])
async def list_platforms(
    services: Services, _: Reader, industry: str | None = None, offset: Offset = 0, limit: Limit = 0
) -> list[PlatformResponse]:
    return await services.platforms.list_platforms(industry, offset, limit)


@ROUTER.get("/platforms/{key}", response_model=PlatformResponse, tags=["platforms"])
async def read_platform(key: str, services: Services, _: Reader) -> PlatformResponse:
    return await services.platforms.get_platform(key)


@ROUTER.post("/platforms", response_model=PlatformResponse, status_code=CREATED, tags=["platforms"])
async def create_platform(request: PlatformCreateRequest, services: Services, _: SchemaManager) -> PlatformResponse:
    return await services.platforms.create_platform(request)


@ROUTER.get("/platforms/{platform_id}/rename", response_model=RenameResult, tags=["platforms"])
async def preview_platform_rename(platform_id: str, key: str, services: Services, _: SchemaManager) -> RenameResult:
    return await services.platforms.preview_rename(platform_id, key)


@ROUTER.patch("/platforms/{platform_id}", response_model=PlatformResponse, tags=["platforms"])
async def update_platform(
    platform_id: str, request: PlatformUpdateRequest, services: Services, _: SchemaManager
) -> PlatformResponse:
    return await services.platforms.update_platform(platform_id, request)


@ROUTER.delete("/platforms/{platform_id}", response_model=OperationResult, tags=["platforms"])
async def delete_platform(platform_id: str, services: Services, user: SchemaManager) -> OperationResult:
    await services.platforms.delete_platform(platform_id, user)
    return OperationResult(message="The platform was removed", affected=1)
