"""Discovery of dynamic keys that are stored under `data` but were never declared.

Such keys still deserve a (hidden) column so stored values never become invisible, e.g. after a field declaration
was deleted. Discovery scans a bounded window of the matching documents (the first `scan_limit` in natural order).
"""

from datetime import UTC, datetime
from typing import Any

from sky_core.models.enums import FieldScope, FieldType
from sky_core.models.field import FieldMetadata, FieldResponse
from sky_core.mongo import Collection

from sky_grid.constants import DYNAMIC_VALUE_ROOT

DEFAULT_SCAN_LIMIT = 500
DEFAULT_DISTINCT_LIMIT = 50
DEFAULT_DISTINCT_SCAN_LIMIT = 20_000
DISCOVERED_ORDER = 900
BSON_TYPE_MAPPING: dict[str, FieldType] = {
    "string": FieldType.STRING,
    "int": FieldType.INTEGER,
    "long": FieldType.INTEGER,
    "double": FieldType.NUMBER,
    "decimal": FieldType.NUMBER,
    "bool": FieldType.BOOLEAN,
    "date": FieldType.DATETIME,
    "object": FieldType.JSON,
    "array": FieldType.JSON,
}


class SchemaIntrospector:
    """Reads `collection` restricted by `base_filter` (e.g. not deleted)."""

    def __init__(
        self,
        collection: Collection,
        base_filter: dict[str, Any] | None = None,
        scan_limit: int = DEFAULT_SCAN_LIMIT,
        distinct_scan_limit: int = DEFAULT_DISTINCT_SCAN_LIMIT,
    ) -> None:
        self._collection = collection
        self._base_filter = dict(base_filter or {})
        self._scan_limit = scan_limit
        self._distinct_scan_limit = distinct_scan_limit

    async def discover_dynamic_keys(self, scope_filter: dict[str, Any] | None = None) -> dict[str, FieldType]:
        pipeline: list[dict[str, Any]] = [
            {"$match": {**self._base_filter, **(scope_filter or {})}},
            {"$limit": self._scan_limit},
            {"$project": {"pairs": {"$objectToArray": {"$ifNull": [f"${DYNAMIC_VALUE_ROOT}", {}]}}}},
            {"$unwind": "$pairs"},
            {"$group": {"_id": "$pairs.k", "types": {"$addToSet": {"$type": "$pairs.v"}}}},
            {"$sort": {"_id": 1}},
        ]
        return {
            str(document["_id"]): pick_field_type([str(name) for name in document.get("types", [])])
            async for document in self._collection.aggregate(pipeline)
        }

    async def infer_missing_fields(
        self,
        declared_keys: set[str],
        scope: FieldScope,
        industry: str | None = None,
        scope_filter: dict[str, Any] | None = None,
    ) -> list[FieldResponse]:
        """A hidden, non-editable declaration per undeclared key; `order` counts every discovered key."""
        discovered = await self.discover_dynamic_keys(scope_filter)
        now = datetime.now(tz=UTC)
        return [
            FieldResponse(
                id=f"discovered:{key}",
                name=key.replace("_", " ").title(),
                key=key,
                type=field_type,
                scope=scope,
                industry=industry,
                discovered=True,
                metadata=FieldMetadata(description="Discovered from the stored documents"),
                editable=False,
                visible=False,
                order=DISCOVERED_ORDER + index,
                created_at=now,
            )
            for index, (key, field_type) in enumerate(sorted(discovered.items()))
            if key not in declared_keys
        ]

    async def distinct_values(self, path: str, limit: int = DEFAULT_DISTINCT_LIMIT) -> list[str]:
        """The most frequent values at `path`, as text (an array value is grouped and printed whole)."""
        pipeline: list[dict[str, Any]] = [
            {"$match": {**self._base_filter, path: {"$nin": [None, ""]}}},
            {"$limit": self._distinct_scan_limit},
            {"$group": {"_id": f"${path}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1, "_id": 1}},
            {"$limit": limit},
        ]
        return [str(document["_id"]) async for document in self._collection.aggregate(pipeline)]


def pick_field_type(bson_types: list[str]) -> FieldType:
    mapped = {BSON_TYPE_MAPPING[name] for name in bson_types if name in BSON_TYPE_MAPPING}
    if len(mapped) == 1:
        return mapped.pop()
    if mapped and mapped <= {FieldType.INTEGER, FieldType.NUMBER}:
        return FieldType.NUMBER
    return FieldType.STRING
