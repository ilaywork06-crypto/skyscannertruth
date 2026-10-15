"""Industries, addressed by key. There is no delete and no rename: the key is referenced everywhere as is."""

from sky_core.errors import ConflictError, NotFoundError
from sky_core.models.industry import IndustryCreateRequest, IndustryResponse, IndustryUpdateRequest

from events_service.documents import IndustryDocument
from events_service.repositories.declarations import IndustryRepository
from events_service.repositories.events import EventRepository


class IndustryService:
    def __init__(self, repository: IndustryRepository, events: EventRepository) -> None:
        self._repository = repository
        self._events = events

    async def list_industries(self, offset: int = 0, limit: int = 0) -> list[IndustryResponse]:
        documents = await self._repository.list_all(offset, limit)
        counts = await self._events.counts_by_industry()
        return [document.to_response(event_count=counts.get(document.key, 0)) for document in documents]

    async def get_industry(self, key: str) -> IndustryResponse:
        document = await self._require(key)
        counts = await self._events.counts_by_industry()
        return document.to_response(event_count=counts.get(key, 0))

    async def create_industry(self, request: IndustryCreateRequest) -> IndustryResponse:
        if await self._repository.find_by_key(request.key) is not None:
            raise ConflictError("An industry with this key already exists", {"key": request.key})
        document = IndustryDocument(**request.model_dump())
        await self._repository.insert(document)
        return document.to_response(event_count=0)

    async def update_industry(self, key: str, request: IndustryUpdateRequest) -> IndustryResponse:
        document = await self._require(key)
        await self._repository.update_fields(document.id, request.model_dump(exclude_unset=True, exclude_none=True))
        return await self.get_industry(key)

    async def allowed_modules(self, key: str) -> list[str]:
        """The industry's module vocabulary; empty (anything goes) when the industry is unknown."""
        document = await self._repository.find_by_key(key)
        return [] if document is None else list(document.modules)

    async def _require(self, key: str) -> IndustryDocument:
        document = await self._repository.find_by_key(key)
        if document is None:
            raise NotFoundError("The industry does not exist", {"key": key})
        return document
