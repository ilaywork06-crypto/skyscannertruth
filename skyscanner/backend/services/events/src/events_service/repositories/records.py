"""Per-user records (saved views, subscriptions) and the append-only journals (revisions, notification outbox,
the event number counter)."""

from pymongo import ASCENDING, DESCENDING, IndexModel, ReturnDocument

from events_service.constants import (
    COUNTERS_COLLECTION,
    OUTBOX_COLLECTION,
    REVISIONS_COLLECTION,
    SUBSCRIPTIONS_COLLECTION,
    TEMPLATES_COLLECTION,
)
from events_service.documents import OutboxDocument, RevisionDocument, SubscriptionDocument, TemplateDocument
from events_service.repositories.base import Query, Repository
from sky_core.models.enums import FieldScope
from sky_core.mongo import MongoProvider


class TemplateRepository(Repository[TemplateDocument]):
    collection_name = TEMPLATES_COLLECTION
    document_type = TemplateDocument

    def indexes(self) -> list[IndexModel]:
        keys = [("owner", ASCENDING), ("scope", ASCENDING), ("name", ASCENDING)]
        return [*super().indexes(), IndexModel(keys, unique=True, name="template_name_unique")]

    async def list_visible(
        self, owner: str, scope: FieldScope, industry: str | None, offset: int = 0, limit: int = 0
    ) -> list[TemplateDocument]:
        """The caller's own views and the shared ones; global views (no industry) show everywhere."""
        query: Query = {"scope": scope.value, "$or": [{"owner": owner}, {"shared": True}]}
        if industry:
            query["$and"] = [{"$or": [{"industry": None}, {"industry": industry}]}]
        return await self.find_many(query, sort=[("name", ASCENDING)], skip=offset, limit=limit)


class SubscriptionRepository(Repository[SubscriptionDocument]):
    collection_name = SUBSCRIPTIONS_COLLECTION
    document_type = SubscriptionDocument

    def indexes(self) -> list[IndexModel]:
        target = [(name, ASCENDING) for name in ("owner", "email", "industry", "event_type_key", "event_id")]
        return [
            *super().indexes(),
            IndexModel(target, unique=True, name="subscription_recipient_target_unique"),
            IndexModel([("active", ASCENDING), ("industry", ASCENDING)], name="active_industry"),
        ]

    async def drop_legacy_indexes(self) -> None:
        await self.drop_index_if_present("subscription_target_unique")

    async def list_for_owner(self, owner: str, offset: int = 0, limit: int = 0) -> list[SubscriptionDocument]:
        return await self.find_many({"owner": owner}, sort=[("created_at", ASCENDING)], skip=offset, limit=limit)


class RevisionRepository(Repository[RevisionDocument]):
    collection_name = REVISIONS_COLLECTION
    document_type = RevisionDocument
    soft_deletable = False

    def indexes(self) -> list[IndexModel]:
        keys = [("event_id", ASCENDING), ("entity_id", ASCENDING), ("version", DESCENDING)]
        return [IndexModel(keys, name="revision_history")]

    async def next_version(self, event_id: str, entity_id: str | None) -> int:
        """1 + the highest version of that target (not atomic: concurrent edits may share a number)."""
        latest = await self.find_many(
            {"event_id": event_id, "entity_id": entity_id}, sort=[("version", DESCENDING)], limit=1
        )
        return latest[0].version + 1 if latest else 1

    async def list_history(
        self, event_id: str, entity_id: str | None = None, include_entities: bool = False
    ) -> list[RevisionDocument]:
        query: Query = {"event_id": event_id}
        if entity_id is not None:
            query["entity_id"] = entity_id
        elif not include_entities:
            query["entity_id"] = None
        return await self.find_many(query, sort=[("changed_at", DESCENDING)])


class OutboxRepository(Repository[OutboxDocument]):
    collection_name = OUTBOX_COLLECTION
    document_type = OutboxDocument
    soft_deletable = False

    def indexes(self) -> list[IndexModel]:
        return [IndexModel([("processed_at", ASCENDING), ("created_at", ASCENDING)], name="pending")]


class CounterRepository:
    """Running numbers: `{_id: <name>, value: <last number>}`."""

    def __init__(self, provider: MongoProvider) -> None:
        self._provider = provider

    async def next_value(self, name: str) -> int:
        """Atomic increment; the first number is 1. A number taken by a failed write is not given back."""
        counters = self._provider.collection(COUNTERS_COLLECTION)
        updated = await counters.find_one_and_update(
            {"_id": name}, {"$inc": {"value": 1}}, upsert=True, return_document=ReturnDocument.AFTER
        )
        return int(updated["value"]) if updated else 1

    async def set_minimum(self, name: str, minimum: int) -> None:
        await self._provider.collection(COUNTERS_COLLECTION).update_one(
            {"_id": name}, {"$max": {"value": minimum}}, upsert=True
        )
