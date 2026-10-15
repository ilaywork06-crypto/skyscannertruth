"""Events, their entities and their edit history."""

from typing import Annotated

from fastapi import APIRouter, Query, status

from events_service.api.deps import EntityManager, EventCreator, EventEditor, EventRemover, Limit, Offset, Reader
from events_service.wiring import Services
from sky_core.models.common import OperationResult
from sky_core.models.entity import EntityCreateRequest, EntityResponse, EntityUpdateRequest
from sky_core.models.event import EventCreateRequest, EventResponse, EventSummaryResponse, EventUpdateRequest
from sky_core.models.pagination import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, Page
from sky_core.models.query import SearchQuery
from sky_core.models.revision import RevisionResponse

ROUTER = APIRouter(tags=["events"])


@ROUTER.post("/events/search", response_model=Page[EventSummaryResponse])
async def search_events(query: SearchQuery, services: Services, _: Reader) -> Page[EventSummaryResponse]:
    return await services.events.search_events(query)


@ROUTER.get("/events/{event_id}", response_model=EventResponse)
async def read_event(event_id: str, services: Services, _: Reader) -> EventResponse:
    return await services.events.get_event(event_id)


@ROUTER.post("/events", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(request: EventCreateRequest, services: Services, user: EventCreator) -> EventResponse:
    return await services.events.create_event(request, user)


@ROUTER.patch("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str, request: EventUpdateRequest, services: Services, user: EventEditor
) -> EventResponse:
    return await services.events.update_event(event_id, request, user)


@ROUTER.delete("/events/{event_id}", response_model=OperationResult)
async def delete_event(event_id: str, services: Services, user: EventRemover) -> OperationResult:
    await services.events.delete_event(event_id, user)
    return OperationResult(message="The event was removed", affected=1)


@ROUTER.get("/events", response_model=Page[EventSummaryResponse])
async def list_events(
    services: Services,
    _: Reader,
    industry: str | None = None,
    search: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)] = DEFAULT_PAGE_SIZE,
) -> Page[EventSummaryResponse]:
    query = SearchQuery(industry=industry, search=search, page=page, page_size=page_size)
    return await services.events.search_events(query)


@ROUTER.get("/events/{event_id}/entities", response_model=list[EntityResponse])
async def list_entities(
    event_id: str, services: Services, _: Reader, entity_type: str | None = None, offset: Offset = 0, limit: Limit = 0
) -> list[EntityResponse]:
    return await services.entities.list_entities(event_id, entity_type, offset, limit)


@ROUTER.post("/events/{event_id}/entities", response_model=EntityResponse, status_code=status.HTTP_201_CREATED)
async def add_entity(
    event_id: str, request: EntityCreateRequest, services: Services, user: EntityManager
) -> EntityResponse:
    return await services.entities.add_entity(event_id, request, user)


@ROUTER.patch("/events/{event_id}/entities/{entity_id}", response_model=EntityResponse)
async def update_entity(
    event_id: str, entity_id: str, request: EntityUpdateRequest, services: Services, user: EntityManager
) -> EntityResponse:
    return await services.entities.update_entity(event_id, entity_id, request, user)


@ROUTER.delete("/events/{event_id}/entities/{entity_id}", response_model=OperationResult)
async def delete_entity(event_id: str, entity_id: str, services: Services, user: EntityManager) -> OperationResult:
    await services.entities.delete_entity(event_id, entity_id, user)
    return OperationResult(message="The entity was removed", affected=1)


@ROUTER.get("/events/{event_id}/revisions", response_model=list[RevisionResponse])
async def list_event_revisions(
    event_id: str, services: Services, _: Reader, include_entities: bool = False
) -> list[RevisionResponse]:
    return await services.revisions.list_history(event_id, include_entities=include_entities)


@ROUTER.get("/events/{event_id}/entities/{entity_id}/revisions", response_model=list[RevisionResponse])
async def list_entity_revisions(event_id: str, entity_id: str, services: Services, _: Reader) -> list[RevisionResponse]:
    return await services.revisions.list_history(event_id, entity_id=entity_id)
