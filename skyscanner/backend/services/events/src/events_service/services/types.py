"""Event and entity types (collection `types`).

Updates write nulls that are sent (unlike most other updates). A key change is carried through the stored documents
first, then the declaration is written, then a label change is copied into the events (matched by type id).
"""

from typing import Any

from events_service.constants import ENTITY_TYPE_KIND, EVENT_TYPE_KIND
from events_service.documents import TypeDocument
from events_service.repositories.declarations import TypeRepository
from events_service.services.renames import RenameService, Tally
from sky_core.errors import ConflictError, NotFoundError, ValidationError
from sky_core.models.common import RenameResult, UserContext
from sky_core.models.entity import EntityTypeCreateRequest, EntityTypeResponse, EntityTypeUpdateRequest
from sky_core.models.event import EventTypeCreateRequest, EventTypeResponse, EventTypeUpdateRequest


class TypeService:
    def __init__(self, repository: TypeRepository, renames: RenameService) -> None:
        self._repository = repository
        self._renames = renames

    async def list_event_types(self, industry: str | None, offset: int = 0, limit: int = 0) -> list[EventTypeResponse]:
        documents = await self._repository.list_kind(EVENT_TYPE_KIND, industry, offset, limit)
        return [document.to_event_type() for document in documents]

    async def list_entity_types(
        self, industry: str | None, offset: int = 0, limit: int = 0
    ) -> list[EntityTypeResponse]:
        documents = await self._repository.list_kind(ENTITY_TYPE_KIND, industry, offset, limit)
        return [document.to_entity_type() for document in documents]

    async def create_event_type(self, request: EventTypeCreateRequest) -> EventTypeResponse:
        document = await self._insert(EVENT_TYPE_KIND, request.key, request.model_dump(exclude={"key"}))
        return document.to_event_type()

    async def create_entity_type(self, request: EntityTypeCreateRequest) -> EntityTypeResponse:
        document = await self._insert(ENTITY_TYPE_KIND, request.key, request.model_dump(exclude={"key"}))
        return document.to_entity_type()

    async def update_event_type(self, type_id: str, request: EventTypeUpdateRequest) -> EventTypeResponse:
        return (await self._update(type_id, request.model_dump(exclude_unset=True), entity=False)).to_event_type()

    async def update_entity_type(self, type_id: str, request: EntityTypeUpdateRequest) -> EntityTypeResponse:
        return (await self._update(type_id, request.model_dump(exclude_unset=True), entity=True)).to_entity_type()

    async def delete_type(self, type_id: str, user: UserContext) -> None:
        """Events keep their references to a deleted type."""
        if not await self._repository.delete(type_id, user.username):
            raise NotFoundError("The type does not exist", {"id": type_id})

    async def preview_rename(self, type_id: str, key: str) -> RenameResult:
        document = await self._require(type_id)
        affected = await self._rename(document, key, entity=document.kind == ENTITY_TYPE_KIND, apply=False)
        return RenameResult(key=key, previous_key=document.key, affected=affected)

    async def resolve_event_types(self, keys: list[str]) -> list[TypeDocument]:
        """Strict, in the given order: an unknown key is a 404."""
        return [await self._resolve(EVENT_TYPE_KIND, key) for key in keys]

    async def resolve_known_event_types(self, keys: list[str]) -> list[TypeDocument]:
        """Tolerant: unknown keys are skipped."""
        found = [await self._repository.find_by_key(EVENT_TYPE_KIND, key) for key in keys]
        return [document for document in found if document is not None]

    async def resolve_entity_type(self, key: str) -> TypeDocument:
        return await self._resolve(ENTITY_TYPE_KIND, key)

    async def _resolve(self, kind: str, key: str) -> TypeDocument:
        document = await self._repository.find_by_key(kind, key)
        if document is None:
            raise NotFoundError("The type is not declared", {"kind": kind, "key": key})
        return document

    async def _insert(self, kind: str, key: str, values: dict[str, Any]) -> TypeDocument:
        if await self._repository.find_by_key(kind, key) is not None:
            raise ConflictError("A type with this key is already declared", {"kind": kind, "key": key})
        document = TypeDocument(kind=kind, key=key, **values)
        await self._repository.insert(document)
        return document

    async def _update(self, type_id: str, updates: dict[str, Any], entity: bool) -> TypeDocument:
        """The endpoint (not the stored kind) decides which rename runs, as before."""
        stored = await self._require(type_id)
        await self._move_key(stored, updates, entity)
        await self._repository.update_fields(type_id, updates)
        name = updates.get("name")
        if isinstance(name, str) and name != stored.name:
            await self._renames.relabel_type(stored.id, name, entity)
        return await self._require(type_id)

    async def _require(self, type_id: str) -> TypeDocument:
        document = await self._repository.find_by_id(type_id)
        if document is None:
            raise NotFoundError("The type does not exist", {"id": type_id})
        return document

    async def _move_key(self, document: TypeDocument, updates: dict[str, Any], entity: bool) -> None:
        key = updates.get("key")
        if key is None or key == document.key:
            updates.pop("key", None)
            return
        if not isinstance(key, str) or not key.strip():
            raise ValidationError("A type needs a key", {"id": document.id})
        taken = await self._repository.find_by_key(document.kind, key)
        if taken is not None and taken.id != document.id:
            raise ConflictError("A type with this key is already declared", {"kind": document.kind, "key": key})
        await self._rename(document, key, entity, apply=True)

    async def _rename(self, document: TypeDocument, key: str, entity: bool, apply: bool) -> Tally:
        if entity:
            return await self._renames.rename_entity_type(document.key, key, apply)
        return await self._renames.rename_event_type(document.key, key, apply)
