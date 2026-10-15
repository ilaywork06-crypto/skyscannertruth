"""Saved views (templates): visible to their owner, and to everyone when shared; only the owner may change them."""

from sky_core.clock import utc_now
from sky_core.errors import ConflictError, NotFoundError, PermissionDeniedError
from sky_core.models.common import UserContext
from sky_core.models.enums import FieldScope
from sky_core.models.template import TemplateCreateRequest, TemplateResponse, TemplateUpdateRequest

from events_service.documents import TemplateDocument
from events_service.repositories.records import TemplateRepository


class TemplateService:
    def __init__(self, repository: TemplateRepository) -> None:
        self._repository = repository

    async def list_templates(
        self, user: UserContext, scope: FieldScope, industry: str | None, offset: int = 0, limit: int = 0
    ) -> list[TemplateResponse]:
        documents = await self._repository.list_visible(user.username, scope, industry, offset, limit)
        return [document.to_response() for document in documents]

    async def create_template(self, request: TemplateCreateRequest, user: UserContext) -> TemplateResponse:
        await self._require_free_name(user, request.scope, request.name)
        document = TemplateDocument(**request.model_dump(), owner=user.username)
        await self._repository.insert(document)
        return document.to_response()

    async def update_template(
        self, template_id: str, request: TemplateUpdateRequest, user: UserContext
    ) -> TemplateResponse:
        document = await self._require_own(template_id, user)
        if request.name is not None and request.name != document.name:
            await self._require_free_name(user, document.scope, request.name)
        updates = request.model_dump(exclude_unset=True, exclude_none=True)
        updates["updated_at"] = utc_now()
        await self._repository.update_fields(document.id, updates)
        return (await self._require_own(template_id, user)).to_response()

    async def delete_template(self, template_id: str, user: UserContext) -> None:
        document = await self._require_own(template_id, user)
        await self._repository.delete(document.id, user.username)

    async def _require_free_name(self, user: UserContext, scope: FieldScope, name: str) -> None:
        taken = await self._repository.find_one({"owner": user.username, "scope": scope.value, "name": name})
        if taken is not None:
            raise ConflictError("A template with this name already exists", {"name": name})

    async def _require_own(self, template_id: str, user: UserContext) -> TemplateDocument:
        document = await self._repository.find_by_id(template_id)
        if document is None:
            raise NotFoundError("The template does not exist", {"id": template_id})
        if document.owner != user.username:
            raise PermissionDeniedError("Only the owner of a template may change it")
        return document
