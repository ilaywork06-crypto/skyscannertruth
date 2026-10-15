"""Events (with their nested entities) and the inventory query.

The query combines, with AND: industry narrowing, a literal free-text search, event filter conditions, entity filter
conditions (keys starting with `objects.`, which must all hold on the same live entity) and the parse state.

Totals are cached per process for 15 s (512 entries) because counting is the expensive part of paging; every write
through this repository clears the cache.
"""

import asyncio
import json
import time
from collections import OrderedDict
from collections.abc import AsyncIterator
from typing import Any

from pymongo import ASCENDING, DESCENDING, IndexModel

from events_service.constants import (
    ENTITY_FILTER_PREFIX,
    EVENT_SEARCH_PATHS,
    EVENTS_COLLECTION,
    FIXED_ENTITY_KEYS,
    FIXED_EVENT_KEYS,
)
from events_service.documents import EntityDocument, EventDocument
from events_service.repositories.base import ID, NOT_DELETED, Query, Repository, alive
from sky_core.clock import utc_now
from sky_core.log import get_logger
from sky_core.models.enums import EntityStatus, ParseState
from sky_core.models.query import FilterCondition, SearchQuery
from sky_grid.constants import DYNAMIC_VALUE_ROOT
from sky_grid.query import build_mongo_filter, build_mongo_sort, build_text_search_filter, merge_filters

LOGGER = get_logger(__name__)
DEFAULT_SORT: list[tuple[str, int]] = [("created_at", DESCENDING)]
WITHOUT_ENTITIES = {"objects": 0}
TOTAL_CACHE_TTL_SECONDS = 15.0
TOTAL_CACHE_ENTRIES = 512
INDUSTRY_COUNTS_KEY = "__industry_counts__"
MAX_DYNAMIC_INDEXES = 32
ITERATION_BATCH = 500
LEGACY_INDEXES = ("status", "experiment_result", "event_type_keys", "platform_created")
_TOTALS: OrderedDict[str, tuple[float, Any]] = OrderedDict()


class EventRepository(Repository[EventDocument]):
    collection_name = EVENTS_COLLECTION
    document_type = EventDocument

    def indexes(self) -> list[IndexModel]:
        def index(name: str, *keys: tuple[str, int], unique: bool = False) -> IndexModel:
            return IndexModel(list(keys), name=name, unique=unique)

        return [
            *super().indexes(),
            index("event_id_unique", ("event_id", ASCENDING), unique=True),
            index("created_at", ("created_at", DESCENDING)),
            index("updated_at", ("updated_at", DESCENDING)),
            index("event_date", ("event_date", DESCENDING)),
            index("name", ("name", ASCENDING)),
            index("industry_created", ("industry", ASCENDING), ("created_at", DESCENDING)),
            index("industry_event_date", ("industry", ASCENDING), ("event_date", DESCENDING)),
            index(
                "industry_status_created", ("industry", ASCENDING), ("status", ASCENDING), ("created_at", DESCENDING)
            ),
            index("status_created", ("status", ASCENDING), ("created_at", DESCENDING)),
            index("experiment_result_created", ("experiment_result", ASCENDING), ("created_at", DESCENDING)),
            index("event_type_created", ("event_type_keys", ASCENDING), ("created_at", DESCENDING)),
            index("platforms_created", ("platforms", ASCENDING), ("created_at", DESCENDING)),
        ]

    async def ensure_dynamic_indexes(self, keys: list[str]) -> None:
        """Indexes `data.<key>` for up to 32 declared keys (alphabetically first)."""
        wanted = sorted({key for key in keys if key})[:MAX_DYNAMIC_INDEXES]
        await self.create_indexes(
            [IndexModel([(f"{DYNAMIC_VALUE_ROOT}.{key}", ASCENDING)], name=f"dynamic_{key}") for key in wanted]
        )

    async def drop_legacy_indexes(self) -> None:
        for name in LEGACY_INDEXES:
            await self.drop_index_if_present(name)

    # ----- the inventory query ----- #

    def build_query(self, search: SearchQuery, identifiers: list[str] | None = None) -> Query:
        event_conditions, entity_conditions = _split_conditions(search.filters)
        industries = [industry for industry in search.industries if industry]
        return merge_filters(
            {"industry": search.industry} if search.industry else {},
            {"industry": {"$in": industries}} if industries else {},
            build_text_search_filter(search.search or "", EVENT_SEARCH_PATHS),
            build_mongo_filter(event_conditions, FIXED_EVENT_KEYS),
            _entity_clause(entity_conditions),
            _parse_state_clause(search.parse_state),
            {ID: {"$in": identifiers}} if identifiers else {},
        )

    @staticmethod
    def build_sort(search: SearchQuery) -> list[tuple[str, int]]:
        return build_mongo_sort(search.sort, FIXED_EVENT_KEYS) or DEFAULT_SORT

    async def search(self, search: SearchQuery) -> tuple[list[EventDocument], int]:
        """One page of summaries (entities are not loaded) and the total."""
        query = self.build_query(search)
        page = self.find_many(
            query,
            sort=self.build_sort(search),
            skip=(search.page - 1) * search.page_size,
            limit=search.page_size,
            projection=WITHOUT_ENTITIES,
        )
        documents, total = await asyncio.gather(page, self.count_matching(query))
        return documents, total

    async def iterate(
        self, search: SearchQuery, identifiers: list[str] | None = None, limit: int = 0
    ) -> AsyncIterator[EventDocument]:
        """Every matching event with its entities, streamed from the cursor (no cap unless `limit`)."""
        cursor = self.collection.find(alive(self.build_query(search, identifiers)), batch_size=ITERATION_BATCH)
        cursor = cursor.sort(self.build_sort(search))
        if limit:
            cursor = cursor.limit(limit)
        async for raw in cursor:
            yield EventDocument.model_validate(raw)

    async def count_matching(self, query: Query) -> int:
        fingerprint = json.dumps(query, sort_keys=True, default=repr)
        remembered = _recall(fingerprint)
        if remembered is not None:
            return int(remembered)
        total = await self.count(query)
        _remember(fingerprint, total)
        return total

    async def counts_by_industry(self) -> dict[str, int]:
        remembered = _recall(INDUSTRY_COUNTS_KEY)
        if remembered is not None:
            return dict(remembered)
        keys = [value for value in await self.collection.distinct("industry", NOT_DELETED) if isinstance(value, str)]
        totals = await asyncio.gather(*(self.count({"industry": key}) for key in keys))
        counts = dict(zip(keys, totals, strict=True))
        _remember(INDUSTRY_COUNTS_KEY, counts)
        return counts

    async def exists_any(self, query: Query) -> bool:
        """Whether any document, deleted or not, matches."""
        return await self.collection.find_one(query, projection={ID: 1}) is not None

    async def live_ids(self, identifiers: list[str]) -> set[str]:
        cursor = self.collection.find({ID: {"$in": identifiers}, **NOT_DELETED}, projection={ID: 1})
        return {str(raw[ID]) async for raw in cursor}

    # ----- nested entities ----- #

    async def add_entity(self, event_id: str, entity: EntityDocument) -> bool:
        result = await self.collection.update_one(
            {ID: event_id},
            {
                "$push": {"objects": entity.model_dump()},
                "$inc": {f"entity_counts.{entity.object_type_key}": 1},
                "$set": {"updated_at": utc_now()},
            },
        )
        self._on_write()
        return bool(result.matched_count)

    async def update_entity(self, event_id: str, entity_id: str, updates: dict[str, Any]) -> bool:
        """Sets entity fields and the event's `updated_at`."""
        changes: dict[str, Any] = {f"objects.$[entity].{key}": value for key, value in updates.items()}
        changes["updated_at"] = utc_now()
        result = await self.collection.update_one(
            {ID: event_id}, {"$set": changes}, array_filters=[{"entity.id": entity_id}]
        )
        self._on_write()
        return bool(result.matched_count)

    async def remove_entity(self, event_id: str, entity_id: str, entity_type_key: str, user: str) -> bool:
        now = utc_now()
        result = await self.collection.update_one(
            {ID: event_id},
            {
                "$set": {
                    "objects.$[entity].deleted": True,
                    "objects.$[entity].deleted_at": now,
                    "objects.$[entity].deleted_by": user,
                    "updated_at": now,
                },
                "$inc": {f"entity_counts.{entity_type_key}": -1},
            },
            array_filters=[{"entity.id": entity_id}],
        )
        self._on_write()
        return bool(result.matched_count)

    def _on_write(self) -> None:
        _TOTALS.clear()


def _recall(fingerprint: str) -> Any:
    remembered = _TOTALS.get(fingerprint)
    if remembered is None:
        return None
    taken_at, value = remembered
    if time.monotonic() - taken_at > TOTAL_CACHE_TTL_SECONDS:
        _TOTALS.pop(fingerprint, None)
        return None
    return value


def _remember(fingerprint: str, value: Any) -> None:
    _TOTALS[fingerprint] = (time.monotonic(), value)
    _TOTALS.move_to_end(fingerprint)
    while len(_TOTALS) > TOTAL_CACHE_ENTRIES:
        _TOTALS.popitem(last=False)


def _split_conditions(conditions: list[FilterCondition]) -> tuple[list[FilterCondition], list[FilterCondition]]:
    events: list[FilterCondition] = []
    entities: list[FilterCondition] = []
    for condition in conditions:
        if not condition.key.startswith(ENTITY_FILTER_PREFIX):
            events.append(condition)
        elif key := condition.key.removeprefix(ENTITY_FILTER_PREFIX):
            entities.append(condition.model_copy(update={"key": key}))
    return events, entities


def _entity_clause(conditions: list[FilterCondition]) -> Query:
    inner = build_mongo_filter(conditions, FIXED_ENTITY_KEYS)
    if not inner:
        return {}
    return {"objects": {"$elemMatch": merge_filters(dict(NOT_DELETED), inner)}}


def _parse_state_clause(parse_state: ParseState) -> Query:
    """`parsed`: at least one live entity and all live entities parsed. `not_parsed`: the opposite."""
    live = {"$elemMatch": dict(NOT_DELETED)}
    unparsed = {"$elemMatch": {"status": {"$nin": [EntityStatus.PARSED.value]}, **NOT_DELETED}}
    if parse_state is ParseState.PARSED:
        return {"$and": [{"objects": live}, {"objects": {"$not": unparsed}}]}
    if parse_state is ParseState.NOT_PARSED:
        return {"$or": [{"objects": {"$not": live}}, {"objects": unparsed}]}
    return {}
