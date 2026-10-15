"""Edit history: one revision per event edit and per entity edit, addition or removal. Never written for event
creation, deletion or imports."""

from sky_core.models.common import UserContext
from sky_core.models.enums import RevisionTarget
from sky_core.models.revision import FieldChange, RevisionResponse

from events_service.documents import EntityDocument, EventDocument, RevisionDocument
from events_service.domain.changes import build_changes, flatten_entity, flatten_event
from events_service.repositories.records import RevisionRepository

ENTITY_ATTACHED = "The entity was attached to the event"
ENTITY_REMOVED = "The entity was removed from the event"


class RevisionService:
    def __init__(self, repository: RevisionRepository) -> None:
        self._repository = repository

    async def record_event_change(
        self, before: EventDocument, after: EventDocument, reason: str, user: UserContext
    ) -> None:
        if changes := build_changes(flatten_event(before), flatten_event(after)):
            await self._store(RevisionTarget.EVENT, after.id, None, changes, reason, user)

    async def record_entity_change(
        self, event_id: str, before: EntityDocument, after: EntityDocument, reason: str, user: UserContext
    ) -> None:
        if changes := build_changes(flatten_entity(before), flatten_entity(after)):
            await self._store(RevisionTarget.ENTITY, event_id, after, changes, reason, user)

    async def record_entity_addition(self, event_id: str, entity: EntityDocument, user: UserContext) -> None:
        changes = build_changes({}, flatten_entity(entity))
        await self._store(RevisionTarget.ENTITY, event_id, entity, changes, ENTITY_ATTACHED, user)

    async def record_entity_removal(self, event_id: str, entity: EntityDocument, user: UserContext) -> None:
        changes = build_changes(flatten_entity(entity), {})
        await self._store(RevisionTarget.ENTITY, event_id, entity, changes, ENTITY_REMOVED, user)

    async def list_history(
        self, event_id: str, entity_id: str | None = None, include_entities: bool = False
    ) -> list[RevisionResponse]:
        documents = await self._repository.list_history(event_id, entity_id, include_entities)
        return [document.to_response() for document in documents]

    async def _store(
        self,
        target: RevisionTarget,
        event_id: str,
        entity: EntityDocument | None,
        changes: list[FieldChange],
        reason: str,
        user: UserContext,
    ) -> None:
        entity_id = entity.id if entity else None
        await self._repository.insert(
            RevisionDocument(
                target=target,
                event_id=event_id,
                entity_id=entity_id,
                entity_name=entity.name if entity else "",
                version=await self._repository.next_version(event_id, entity_id),
                reason=reason,
                changed_by=user.username,
                changes=changes,
            )
        )
