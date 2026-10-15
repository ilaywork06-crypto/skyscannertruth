"""Entities: the items nested inside an event (telemetries, log collections...).

Rules: entity files must be unique by name per role; the module must belong to the industry's vocabulary when it
has one; the status follows the parsed files (`domain.status`); dynamic values follow the entity schema, whose
dependencies may read the event's values. Adding an entity writes a revision and an `entity_added` notification;
reaching `parsed` writes an `entity_parsed` notification.
"""

from typing import Any

from events_service.documents import EntityDocument, EventDocument
from events_service.domain.artifacts import require_unique_entity_files
from events_service.domain.changes import entity_update_changes
from events_service.domain.status import resolve_status
from events_service.domain.values import ValueRequest
from events_service.repositories.events import EventRepository
from events_service.services.fields import FieldService
from events_service.services.industries import IndustryService
from events_service.services.outbox import Publisher
from events_service.services.revisions import RevisionService
from events_service.services.types import TypeService
from sky_core.clock import ensure_utc, utc_now
from sky_core.errors import NotFoundError, ValidationError
from sky_core.ids import new_id
from sky_core.models.common import UserContext
from sky_core.models.entity import EntityCreateRequest, EntityResponse, EntityUpdateRequest
from sky_core.models.enums import EntityStatus, FieldScope
from sky_core.models.subscription import SubscriptionTrigger

CLEARABLE_ENTITY_FIELDS = ("module", "code_version", "requested_at", "received_at")
FILE_ROLES = ("raw_files", "parsed_files", "parsed_additional_files")


class EntityService:
    def __init__(
        self,
        events: EventRepository,
        publisher: Publisher,
        types: TypeService,
        fields: FieldService,
        revisions: RevisionService,
        industries: IndustryService,
    ) -> None:
        self._events = events
        self._publisher = publisher
        self._types = types
        self._fields = fields
        self._revisions = revisions
        self._industries = industries

    async def build_entity(
        self,
        request: EntityCreateRequest,
        industry: str,
        event_values: dict[str, Any],
        object_id: int,
        user: UserContext,
    ) -> EntityDocument:
        """A validated entity document, numbered `object_id`, not yet stored."""
        require_unique_entity_files(
            request.name, request.raw_files, request.parsed_files, request.parsed_additional_files
        )
        entity_type = await self._types.resolve_entity_type(request.entity_type_key)
        values = ValueRequest(scope=FieldScope.ENTITY, supplied=request.metadata, context=event_values)
        attributes, flattened = await self._fields.build_values(values, industry, request.entity_type_key)
        await self._require_known_module(industry, request.module)
        status = resolve_status(request.status, None, request.parsed_files, {"name": request.name})
        return EntityDocument(
            id=new_id(),
            object_id=object_id,
            name=request.name,
            object_type=entity_type.to_reference(),
            object_type_name=entity_type.name,
            object_type_key=entity_type.key,
            module=request.module,
            code_version=request.code_version,
            status=status,
            notes=request.notes,
            upload_source=request.upload_source,
            requested_at=ensure_utc(request.requested_at),
            received_at=ensure_utc(request.received_at),
            raw_files=request.raw_files,
            parsed_files=request.parsed_files,
            parsed_additional_files=request.parsed_additional_files,
            metadata=attributes,
            data=flattened,
            created_by=user.username,
        )

    async def list_entities(
        self, event_id: str, entity_type_key: str | None, offset: int = 0, limit: int = 0
    ) -> list[EntityResponse]:
        event = await self._require_event(event_id)
        entities = [e for e in event.live_objects if not entity_type_key or e.object_type_key == entity_type_key]
        window = entities[offset:] if limit <= 0 else entities[offset : offset + limit]
        return [entity.to_response(event_id=event.id) for entity in window]

    async def add_entity(self, event_id: str, request: EntityCreateRequest, user: UserContext) -> EntityResponse:
        """Numbered after every entity ever added to the event, deleted ones included."""
        event = await self._require_event(event_id)
        next_number = max((entity.object_id for entity in event.objects), default=0) + 1
        entity = await self.build_entity(request, event.industry, event.data, next_number, user)
        await self._events.add_entity(event_id, entity)
        await self._revisions.record_entity_addition(event_id, entity, user)
        await self._publisher.publish(event, SubscriptionTrigger.ENTITY_ADDED, f"{entity.name} was added")
        return entity.to_response(event_id=event_id)

    async def update_entity(
        self, event_id: str, entity_id: str, request: EntityUpdateRequest, user: UserContext
    ) -> EntityResponse:
        event = await self._require_event(event_id)
        current = _find_entity(event, entity_id)
        if request.module != current.module:
            await self._require_known_module(event.industry, request.module)
        updates = await self._entity_updates(event, current, request)
        if not entity_update_changes(current, updates):
            raise ValidationError(
                "The request does not change anything about the entity", {"id": entity_id, "reason": request.reason}
            )
        updates["updated_at"] = utc_now()
        updates["updated_by"] = user.username
        await self._events.update_entity(event_id, entity_id, updates)
        refreshed = await self._require_event(event_id)
        updated = _find_entity(refreshed, entity_id)
        await self._revisions.record_entity_change(event_id, current, updated, request.reason, user)
        if updated.status is EntityStatus.PARSED and current.status is not EntityStatus.PARSED:
            summary = f"{updated.name} reached the parsed state"
            await self._publisher.publish(refreshed, SubscriptionTrigger.ENTITY_PARSED, summary)
        return updated.to_response(event_id=event_id)

    async def _entity_updates(
        self, event: EventDocument, current: EntityDocument, request: EntityUpdateRequest
    ) -> dict[str, Any]:
        """The stored form of the sent changes. Lists and metadata are replaced wholesale; the status is always
        recomputed from the resulting parsed files."""
        updates: dict[str, Any] = request.model_dump(exclude_unset=True, exclude_none=True, exclude={"reason"})
        updates.update(
            {
                key: None
                for key in CLEARABLE_ENTITY_FIELDS
                if key in request.model_fields_set and getattr(request, key) is None
            }
        )
        if request.metadata is not None:
            values = ValueRequest(
                scope=FieldScope.ENTITY,
                supplied=request.metadata,
                context=event.data,
                carried=set(current.data),
                previous=current.data,
            )
            attributes, flattened = await self._fields.build_values(values, event.industry, current.object_type_key)
            updates["metadata"] = [attribute.model_dump() for attribute in attributes]
            updates["data"] = flattened
        files = {
            role: getattr(request, role) if getattr(request, role) is not None else getattr(current, role)
            for role in FILE_ROLES
        }
        require_unique_entity_files(request.name or current.name, *files.values())
        for role in FILE_ROLES:
            if getattr(request, role) is not None:
                updates[role] = [artifact.model_dump() for artifact in files[role]]
        status = resolve_status(request.status, current.status, files["parsed_files"], {"id": current.id})
        updates["status"] = status.value
        return updates

    async def delete_entity(self, event_id: str, entity_id: str, user: UserContext) -> None:
        event = await self._require_event(event_id)
        entity = _find_entity(event, entity_id)
        await self._events.remove_entity(event_id, entity_id, entity.object_type_key, user.username)
        await self._revisions.record_entity_removal(event_id, entity, user)

    async def _require_known_module(self, industry: str, module: str | None) -> None:
        if not module:
            return
        allowed = await self._industries.allowed_modules(industry)
        if allowed and module not in allowed:
            raise ValidationError(
                "The module is not one of the values declared for this industry",
                {"module": module, "allowed": ", ".join(allowed)},
            )

    async def _require_event(self, event_id: str) -> EventDocument:
        event = await self._events.find_by_id(event_id)
        if event is None:
            raise NotFoundError("The event does not exist", {"id": event_id})
        return event


def _find_entity(event: EventDocument, entity_id: str) -> EntityDocument:
    for entity in event.live_objects:
        if entity.id == entity_id:
            return entity
    raise NotFoundError("The entity does not exist", {"id": entity_id})
