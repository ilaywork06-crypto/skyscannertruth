"""Rewrites of keys and labels across stored documents (events, saved views, subscriptions, declarations).

A preview counts what would change and writes nothing; an apply rewrites and counts what it rewrote. These queries do
not skip soft-deleted documents: a restored document must not come back with a stale key.
"""

from collections.abc import Callable
from typing import Any

from events_service.constants import (
    EVENTS_COLLECTION,
    FIELDS_COLLECTION,
    SUBSCRIPTIONS_COLLECTION,
    TEMPLATES_COLLECTION,
    TYPES_COLLECTION,
)
from events_service.repositories.base import ID, Query
from sky_core.mongo import MongoProvider

Rewrite = Callable[[dict[str, Any]], dict[str, Any]]


class RenameStore:
    def __init__(self, provider: MongoProvider) -> None:
        self._provider = provider

    async def events(self, query: Query, rewrite: Rewrite, apply: bool) -> int:
        """Matching events are counted (preview) or each rewritten with one `$set` (apply)."""
        events = self._provider.collection(EVENTS_COLLECTION)
        if not apply:
            return int(await events.count_documents(query))
        touched = 0
        async for stored in events.find(query):
            if updates := rewrite(stored):
                await events.update_one({ID: stored[ID]}, {"$set": updates})
            touched += 1
        return touched

    async def simple(self, collection: str, query: Query, updates: dict[str, Any], apply: bool) -> int:
        handle = self._provider.collection(collection)
        if not apply:
            return int(await handle.count_documents(query))
        return int((await handle.update_many(query, {"$set": updates})).modified_count)

    async def subscriptions_following(self, old: str, new: str, apply: bool) -> int:
        return await self.simple(SUBSCRIPTIONS_COLLECTION, {"event_type_key": old}, {"event_type_key": new}, apply)

    async def fields_of_entity_type(self, old: str, new: str, apply: bool) -> int:
        return await self.simple(FIELDS_COLLECTION, {"entity_type": old}, {"entity_type": new}, apply)

    async def type_custom_fields(self, old: str, new: str, apply: bool) -> int:
        types = self._provider.collection(TYPES_COLLECTION)
        query = {"custom_fields": old}
        if not apply:
            return int(await types.count_documents(query))
        result = await types.update_many(
            query, {"$set": {"custom_fields.$[asked]": new}}, array_filters=[{"asked": old}]
        )
        return int(result.modified_count)

    async def templates(self, rewrite: Rewrite, apply: bool) -> int:
        """Saved views the rewrite changes: counted (preview) or written (apply)."""
        templates = self._provider.collection(TEMPLATES_COLLECTION)
        touched = 0
        async for stored in templates.find({}):
            updates = rewrite(stored)
            if not updates:
                continue
            if apply:
                await templates.update_one({ID: stored[ID]}, {"$set": updates})
            touched += 1
        return touched
