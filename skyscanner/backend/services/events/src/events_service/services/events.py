"""Events: create, read, search, update, delete.

Create validates the types (strict, at least one), the platforms against the industry, the brief (required for a
manual upload, generated otherwise), the dynamic values (only the chosen types' custom fields are on the form) and
the nested entities, then takes the next event number and writes an `event_created` notification (no revision).

Update replaces what is sent (lists and metadata wholesale; nulls mean "keep", except the clearable fields), refuses
an edit that changes nothing, writes a revision and an `event_updated` notification. The industry is not validated.
"""

from datetime import datetime
from math import ceil
from typing import Any

from sky_core.clock import ensure_utc, utc_now
from sky_core.errors import NotFoundError, ValidationError
from sky_core.ids import new_id
from sky_core.models.common import UserContext
from sky_core.models.enums import FieldScope, UploadSource
from sky_core.models.event import (
    BRIEF_MAX_LENGTH,
    EventCreateRequest,
    EventResponse,
    EventSummaryResponse,
    EventUpdateRequest,
)
from sky_core.models.pagination import Page
from sky_core.models.query import SearchQuery
from sky_core.models.subscription import SubscriptionTrigger

from events_service.constants import EVENT_ID_COUNTER
from events_service.documents import EventDocument, TypeDocument
from events_service.domain.artifacts import require_unique_artifacts
from events_service.domain.brief import fit_event_brief
from events_service.domain.changes import event_update_changes
from events_service.domain.values import ValueRequest
from events_service.repositories.events import EventRepository
from events_service.repositories.records import CounterRepository
from events_service.services.entities import EntityService
from events_service.services.fields import FieldService
from events_service.services.outbox import Publisher
from events_service.services.platforms import PlatformService
from events_service.services.revisions import RevisionService
from events_service.services.types import TypeService

CLEARABLE_EVENT_FIELDS = ("experiment_result", "event_date")
BRIEF_REQUIRED = f"An event needs a brief of at most {BRIEF_MAX_LENGTH} characters"


class EventService:
    def __init__(
        self,
        events: EventRepository,
        counters: CounterRepository,
        publisher: Publisher,
        types: TypeService,
        platforms: PlatformService,
        fields: FieldService,
        entities: EntityService,
        revisions: RevisionService,
    ) -> None:
        self._events = events
        self._counters = counters
        self._publisher = publisher
        self._types = types
        self._platforms = platforms
        self._fields = fields
        self._entities = entities
        self._revisions = revisions

    async def search_events(self, query: SearchQuery) -> Page[EventSummaryResponse]:
        documents, total = await self._events.search(query)
        return Page[EventSummaryResponse](
            items=[document.to_summary() for document in documents],
            total=total,
            page=query.page,
            page_size=query.page_size,
            pages=ceil(total / query.page_size),
        )

    async def get_event(self, event_id: str) -> EventResponse:
        return (await self._require(event_id)).to_response()

    async def create_event(self, request: EventCreateRequest, user: UserContext) -> EventResponse:
        if not request.event_type_keys:
            raise ValidationError("At least one event type has to be chosen")
        if request.upload_source is UploadSource.MANUAL and not (request.name or "").strip():
            raise ValidationError(BRIEF_REQUIRED, {"field": "name"})
        require_unique_artifacts(request.additional_files, "the event")
        types = await self._types.resolve_event_types(request.event_type_keys)
        await self._platforms.resolve_platforms(request.platforms, request.industry)
        values = ValueRequest(scope=FieldScope.EVENT, supplied=request.metadata, asked=_asked_keys(types))
        attributes, flattened = await self._fields.build_values(values, request.industry)
        number = await self._counters.next_value(EVENT_ID_COUNTER)
        event_date = ensure_utc(request.event_date)
        document = EventDocument(
            id=new_id(),
            event_id=number,
            name=_brief(request, types, number, event_date),
            event_type=[declared.to_reference() for declared in types],
            event_type_names=[declared.name for declared in types],
            event_type_keys=[declared.key for declared in types],
            industry=request.industry,
            platforms=list(request.platforms),
            status=request.status,
            experiment_result=request.experiment_result,
            event_date=event_date,
            notes=request.notes,
            additional_files=request.additional_files,
            metadata=attributes,
            data=flattened,
            upload_source=request.upload_source,
            created_by=user.username,
        )
        for object_id, entity_request in enumerate(request.entities, start=1):
            entity = await self._entities.build_entity(entity_request, request.industry, flattened, object_id, user)
            document.objects.append(entity)
            document.entity_counts[entity.object_type_key] = document.entity_counts.get(entity.object_type_key, 0) + 1
        await self._events.insert(document)
        summary = f"A new {document.industry} event was uploaded by {user.username}"
        await self._publisher.publish(document, SubscriptionTrigger.EVENT_CREATED, summary)
        return document.to_response()

    async def update_event(self, event_id: str, request: EventUpdateRequest, user: UserContext) -> EventResponse:
        document = await self._require(event_id)
        updates = await self._event_updates(document, request)
        if not event_update_changes(document, updates):
            raise ValidationError(
                "The request does not change anything about the event", {"id": event_id, "reason": request.reason}
            )
        updates["updated_at"] = utc_now()
        updates["updated_by"] = user.username
        await self._events.update_fields(event_id, updates)
        refreshed = await self._require(event_id)
        await self._revisions.record_event_change(document, refreshed, request.reason, user)
        summary = f"The event was updated by {user.username}: {request.reason}"
        await self._publisher.publish(refreshed, SubscriptionTrigger.EVENT_UPDATED, summary)
        return refreshed.to_response()

    async def _event_updates(self, document: EventDocument, request: EventUpdateRequest) -> dict[str, Any]:
        """The stored form of what the request changes."""
        sent = request.model_fields_set
        updates: dict[str, Any] = request.model_dump(exclude_unset=True, exclude_none=True, exclude={"reason"})
        updates.update({key: None for key in CLEARABLE_EVENT_FIELDS if key in sent and getattr(request, key) is None})
        industry = request.industry or document.industry
        if request.platforms is not None:
            added = [key for key in request.platforms if key not in document.platforms]
            await self._platforms.resolve_platforms(added, industry)
        if request.event_type_keys is not None:
            types = await self._types.resolve_event_types(request.event_type_keys)
            updates["event_type"] = [declared.to_reference().model_dump() for declared in types]
            updates["event_type_names"] = [declared.name for declared in types]
            updates["event_type_keys"] = [declared.key for declared in types]
        if request.name is not None:
            if not request.name.strip():
                raise ValidationError(BRIEF_REQUIRED, {"id": document.id, "field": "name"})
            updates["name"] = request.name.strip()
        if request.metadata is not None:
            keys = request.event_type_keys if request.event_type_keys is not None else document.event_type_keys
            values = ValueRequest(
                scope=FieldScope.EVENT,
                supplied=request.metadata,
                asked=_asked_keys(await self._types.resolve_known_event_types(keys)),
                carried=set(document.data),
                previous=document.data,
            )
            attributes, flattened = await self._fields.build_values(values, industry)
            updates["metadata"] = [attribute.model_dump() for attribute in attributes]
            updates["data"] = flattened
        if request.additional_files is not None:
            require_unique_artifacts(request.additional_files, "the event")
        if request.status is not None:
            updates["status"] = request.status.value
        if request.experiment_result is not None:
            updates["experiment_result"] = request.experiment_result.value
        if request.event_date is not None:
            updates["event_date"] = ensure_utc(request.event_date)
        return updates

    async def delete_event(self, event_id: str, user: UserContext) -> None:
        """Soft delete; files stay in the bucket, no revision and no notification."""
        if not await self._events.delete(event_id, user.username):
            raise NotFoundError("The event does not exist", {"id": event_id})

    async def _require(self, event_id: str) -> EventDocument:
        document = await self._events.find_by_id(event_id)
        if document is None:
            raise NotFoundError("The event does not exist", {"id": event_id})
        return document


def _asked_keys(types: list[TypeDocument]) -> set[str]:
    return {key for declared in types for key in declared.custom_fields}


def _brief(request: EventCreateRequest, types: list[TypeDocument], number: int, moment: datetime | None) -> str:
    written = (request.name or "").strip()
    if written:
        return written
    return fit_event_brief(
        type_names=[declared.name for declared in types],
        platforms=list(request.platforms),
        industry=request.industry,
        moment=moment or utc_now(),
        event_number=number,
        max_length=BRIEF_MAX_LENGTH,
        upload_source=request.upload_source,
    )
