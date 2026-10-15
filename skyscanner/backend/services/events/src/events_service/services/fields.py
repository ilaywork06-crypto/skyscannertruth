"""Field declarations (the dynamic schema) and the enforcement of declared keys on every value write.

Partial updates drop nulls, so a declaration's `default` cannot be reset to null. Changing `type` or `array` does not
migrate stored values. Deleting a declaration keeps the values; they then show as a discovered grid column.
"""

from typing import Any

from events_service.documents import FieldDocument
from events_service.domain.values import ValueRequest, build_values
from events_service.repositories.declarations import FieldRepository
from events_service.services.renames import RenameService
from sky_core.clock import utc_now
from sky_core.errors import ConflictError, NotFoundError, ValidationError
from sky_core.models.common import MetadataAttribute, RenameResult, UserContext
from sky_core.models.enums import FieldScope
from sky_core.models.field import FieldCreateRequest, FieldResponse, FieldUpdateRequest


class FieldService:
    def __init__(self, repository: FieldRepository, renames: RenameService) -> None:
        self._repository = repository
        self._renames = renames

    async def list_fields(
        self,
        scope: FieldScope,
        industry: str | None = None,
        entity_type: str | None = None,
        include_shared: bool = True,
        additional: bool | None = None,
        offset: int = 0,
        limit: int = 0,
    ) -> list[FieldResponse]:
        documents = await self._repository.list_for_scope(
            scope, industry, entity_type, include_shared, additional, offset, limit
        )
        return [document.to_response() for document in documents]

    async def create_field(self, request: FieldCreateRequest, user: UserContext) -> FieldResponse:
        existing = await self._repository.find_by_key(request.scope, request.key, request.industry, request.entity_type)
        if existing is not None:
            raise ConflictError(
                "A field with this key is already declared for the industry",
                {"key": request.key, "scope": request.scope.value},
            )
        document = FieldDocument(**request.model_dump(), created_by=user.username)
        await self._repository.insert(document)
        return document.to_response()

    async def preview_rename(self, field_id: str, key: str) -> RenameResult:
        document = await self._require(field_id)
        affected = await self._renames.rename_field(document.key, key, document.scope, apply=False)
        return RenameResult(key=key, previous_key=document.key, affected=affected)

    async def update_field(self, field_id: str, request: FieldUpdateRequest) -> FieldResponse:
        """A key change is carried through the stored values before the declaration is written."""
        document = await self._require(field_id)
        updates = request.model_dump(exclude_unset=True, exclude_none=True)
        await self._move_key(document, updates)
        updates["updated_at"] = utc_now()
        await self._repository.update_fields(field_id, updates)
        return (await self._require(field_id)).to_response()

    async def delete_field(self, field_id: str, user: UserContext) -> None:
        if not await self._repository.delete(field_id, user.username):
            raise NotFoundError("The field declaration does not exist", {"id": field_id})

    async def build_values(
        self,
        request: ValueRequest,
        industry: str | None,
        entity_type: str | None = None,
    ) -> tuple[list[MetadataAttribute], dict[str, Any]]:
        """Validates and converts supplied values against the declarations that apply (see `domain.values`)."""
        declarations = await self._repository.list_for_scope(request.scope, industry, entity_type)
        return build_values(declarations, request)

    async def _require(self, field_id: str) -> FieldDocument:
        document = await self._repository.find_by_id(field_id)
        if document is None:
            raise NotFoundError("The field declaration does not exist", {"id": field_id})
        return document

    async def _move_key(self, document: FieldDocument, updates: dict[str, Any]) -> None:
        key = updates.get("key")
        if key is None or key == document.key:
            updates.pop("key", None)
            return
        if not isinstance(key, str) or not key.strip():
            raise ValidationError("A field needs a key", {"id": document.id})
        taken = await self._repository.find_by_key(document.scope, key, document.industry, document.entity_type)
        if taken is not None and taken.id != document.id:
            raise ConflictError("A field with this key is already declared", {"key": key})
        await self._renames.rename_field(document.key, key, document.scope)
