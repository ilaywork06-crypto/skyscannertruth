"""The dynamic schema and its vocabularies: fields, event/entity types, platforms and industries.

An empty `industries` list on a type or platform means "every industry"; a field with a null industry is shared.
Lists are ordered by `order`, then `name`.
"""

from pymongo import ASCENDING, IndexModel

from events_service.constants import (
    ENTITY_TYPE_KIND,
    EVENT_TYPE_KIND,
    FIELDS_COLLECTION,
    INDUSTRIES_COLLECTION,
    PLATFORMS_COLLECTION,
    TYPES_COLLECTION,
)
from events_service.documents import FieldDocument, IndustryDocument, PlatformDocument, TypeDocument
from events_service.repositories.base import Query, Repository
from sky_core.models.enums import FieldScope

BY_ORDER = [("order", ASCENDING), ("name", ASCENDING)]


def _visible_to(industry: str | None) -> Query:
    return {"$or": [{"industries": []}, {"industries": industry}]} if industry else {}


class FieldRepository(Repository[FieldDocument]):
    collection_name = FIELDS_COLLECTION
    document_type = FieldDocument

    def indexes(self) -> list[IndexModel]:
        keys = [("scope", ASCENDING), ("industry", ASCENDING), ("entity_type", ASCENDING), ("key", ASCENDING)]
        return [
            *super().indexes(),
            IndexModel(keys, unique=True, name="field_key_unique"),
            IndexModel([("industry", ASCENDING)], name="industry"),
        ]

    async def list_for_scope(
        self,
        scope: FieldScope,
        industry: str | None = None,
        entity_type: str | None = None,
        include_shared: bool = True,
        additional: bool | None = None,
        offset: int = 0,
        limit: int = 0,
    ) -> list[FieldDocument]:
        """Shared and/or the industry's declarations; with neither, every industry's (legacy behaviour)."""
        query: Query = {"scope": scope.value}
        if additional is not None:
            query["additional"] = True if additional else {"$ne": True}
        industries: list[Query] = [{"industry": None}] if include_shared else []
        if industry:
            industries.append({"industry": industry})
        if industries:
            query["$or"] = industries
        if entity_type:
            query["$and"] = [{"$or": [{"entity_type": None}, {"entity_type": entity_type}]}]
        return await self.find_many(query, sort=BY_ORDER, skip=offset, limit=limit)

    async def find_by_key(
        self, scope: FieldScope, key: str, industry: str | None, entity_type: str | None
    ) -> FieldDocument | None:
        return await self.find_one({"scope": scope.value, "key": key, "industry": industry, "entity_type": entity_type})

    async def with_keys(self, keys: list[str]) -> list[FieldDocument]:
        return await self.find_many({"key": {"$in": keys}}) if keys else []


class TypeRepository(Repository[TypeDocument]):
    collection_name = TYPES_COLLECTION
    document_type = TypeDocument

    def indexes(self) -> list[IndexModel]:
        keys = [("kind", ASCENDING), ("key", ASCENDING)]
        return [*super().indexes(), IndexModel(keys, unique=True, name="type_key_unique")]

    async def list_kind(
        self, kind: str, industry: str | None = None, offset: int = 0, limit: int = 0
    ) -> list[TypeDocument]:
        return await self.find_many({"kind": kind, **_visible_to(industry)}, sort=BY_ORDER, skip=offset, limit=limit)

    async def list_event_types(self, industry: str | None = None) -> list[TypeDocument]:
        return await self.list_kind(EVENT_TYPE_KIND, industry)

    async def list_entity_types(self, industry: str | None = None) -> list[TypeDocument]:
        return await self.list_kind(ENTITY_TYPE_KIND, industry)

    async def find_by_key(self, kind: str, key: str) -> TypeDocument | None:
        return await self.find_one({"kind": kind, "key": key})


class PlatformRepository(Repository[PlatformDocument]):
    collection_name = PLATFORMS_COLLECTION
    document_type = PlatformDocument

    def indexes(self) -> list[IndexModel]:
        return [*super().indexes(), IndexModel([("key", ASCENDING)], unique=True, name="platform_key_unique")]

    async def list_all(self, industry: str | None = None, offset: int = 0, limit: int = 0) -> list[PlatformDocument]:
        return await self.find_many(_visible_to(industry), sort=BY_ORDER, skip=offset, limit=limit)

    async def find_by_key(self, key: str) -> PlatformDocument | None:
        return await self.find_one({"key": key})


class IndustryRepository(Repository[IndustryDocument]):
    collection_name = INDUSTRIES_COLLECTION
    document_type = IndustryDocument

    def indexes(self) -> list[IndexModel]:
        return [*super().indexes(), IndexModel([("key", ASCENDING)], unique=True, name="industry_key_unique")]

    async def list_all(self, offset: int = 0, limit: int = 0) -> list[IndustryDocument]:
        return await self.find_many(None, sort=BY_ORDER, skip=offset, limit=limit)

    async def find_by_key(self, key: str) -> IndustryDocument | None:
        return await self.find_one({"key": key})
