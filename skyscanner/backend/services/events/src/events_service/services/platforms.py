"""Platforms (collection `platforms`). Read by key, changed by id. Events store platform keys only, so a label
change needs no cascade; a key change does."""

from typing import Any

from events_service.documents import PlatformDocument
from events_service.repositories.declarations import PlatformRepository
from events_service.services.renames import RenameService
from sky_core.errors import ConflictError, NotFoundError, ValidationError
from sky_core.models.common import RenameResult, UserContext
from sky_core.models.platform import PlatformCreateRequest, PlatformResponse, PlatformUpdateRequest


class PlatformService:
    def __init__(self, repository: PlatformRepository, renames: RenameService) -> None:
        self._repository = repository
        self._renames = renames

    async def list_platforms(self, industry: str | None, offset: int = 0, limit: int = 0) -> list[PlatformResponse]:
        return [document.to_response() for document in await self._repository.list_all(industry, offset, limit)]

    async def get_platform(self, key: str) -> PlatformResponse:
        return (await self._require_key(key)).to_response()

    async def create_platform(self, request: PlatformCreateRequest) -> PlatformResponse:
        if await self._repository.find_by_key(request.key) is not None:
            raise ConflictError("A platform with this key is already declared", {"key": request.key})
        document = PlatformDocument(**request.model_dump())
        await self._repository.insert(document)
        return document.to_response()

    async def update_platform(self, platform_id: str, request: PlatformUpdateRequest) -> PlatformResponse:
        """Nulls that are sent are written (legacy behaviour)."""
        document = await self._require_id(platform_id)
        updates = request.model_dump(exclude_unset=True)
        await self._move_key(document, updates)
        await self._repository.update_fields(platform_id, updates)
        return (await self._require_id(platform_id)).to_response()

    async def preview_rename(self, platform_id: str, key: str) -> RenameResult:
        document = await self._require_id(platform_id)
        affected = await self._renames.rename_platform(document.key, key, apply=False)
        return RenameResult(key=key, previous_key=document.key, affected=affected)

    async def delete_platform(self, platform_id: str, user: UserContext) -> None:
        if not await self._repository.delete(platform_id, user.username):
            raise NotFoundError("The platform does not exist", {"id": platform_id})

    async def resolve_platforms(self, keys: list[str], industry: str) -> list[PlatformDocument]:
        """Every key must be declared and open to the industry (an empty `industries` list allows all)."""
        resolved: list[PlatformDocument] = []
        for key in keys:
            document = await self._require_key(key)
            if document.industries and industry not in document.industries:
                raise ValidationError(
                    "The platform is not declared for the industry of this event",
                    {"platform": document.key, "industry": industry},
                )
            resolved.append(document)
        return resolved

    async def _move_key(self, document: PlatformDocument, updates: dict[str, Any]) -> None:
        key = updates.get("key")
        if key is None or key == document.key:
            updates.pop("key", None)
            return
        if not isinstance(key, str) or not key.strip():
            raise ValidationError("A platform needs a key", {"id": document.id})
        taken = await self._repository.find_by_key(key)
        if taken is not None and taken.id != document.id:
            raise ConflictError("A platform with this key is already declared", {"key": key})
        await self._renames.rename_platform(document.key, key)

    async def _require_id(self, platform_id: str) -> PlatformDocument:
        document = await self._repository.find_by_id(platform_id)
        if document is None:
            raise NotFoundError("The platform does not exist", {"id": platform_id})
        return document

    async def _require_key(self, key: str) -> PlatformDocument:
        document = await self._repository.find_by_key(key)
        if document is None:
            raise NotFoundError("The platform is not declared", {"key": key})
        return document
