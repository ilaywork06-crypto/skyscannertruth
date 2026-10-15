"""Shared repository behaviour: soft-delete aware reads, writes, index creation.

Reads wrap the query as `{"$and": [query, {"deleted": {"$ne": true}}]}` ("not true" also matches documents that lack
the flag), unless the query already speaks about `deleted`.

The unique indexes also cover soft-deleted documents. A write colliding with one (for example re-creating a key a
removed declaration still holds) is answered with a 409 `ConflictError` instead of an unhandled 500.
"""

from typing import Any, Generic, TypeVar

from pydantic import BaseModel
from pymongo import ASCENDING, IndexModel
from pymongo.errors import DuplicateKeyError, OperationFailure

from sky_core.clock import utc_now
from sky_core.errors import ConflictError
from sky_core.log import get_logger
from sky_core.mongo import Collection, MongoProvider

LOGGER = get_logger(__name__)
ID = "_id"
NOT_DELETED: dict[str, Any] = {"deleted": {"$ne": True}}
_INDEX_CONFLICT_CODES = frozenset({85, 86})
_INDEX_MISSING_CODES = frozenset({26, 27})
Query = dict[str, Any]
DocumentT = TypeVar("DocumentT", bound=BaseModel)


def alive(query: Query | None) -> Query:
    if not query:
        return dict(NOT_DELETED)
    if "deleted" in query:
        return dict(query)
    return {"$and": [query, dict(NOT_DELETED)]}


def duplicate_conflict(error: DuplicateKeyError, collection: str) -> ConflictError:
    taken = (error.details or {}).get("keyValue") or {}
    details = {str(key): str(value) for key, value in taken.items()}
    details["collection"] = collection
    return ConflictError(
        "Another document already holds this key or name (it may be a removed one, which can be restored)", details
    )


class Repository(Generic[DocumentT]):
    """CRUD over one collection, validated into `document_type`."""

    collection_name: str
    document_type: type[DocumentT]
    soft_deletable = True

    def __init__(self, provider: MongoProvider) -> None:
        self._provider = provider

    @property
    def collection(self) -> Collection:
        return self._provider.collection(self.collection_name)

    def indexes(self) -> list[IndexModel]:
        return [IndexModel([("deleted", ASCENDING)], name="deleted")] if self.soft_deletable else []

    async def ensure_indexes(self) -> None:
        await self.create_indexes(self.indexes())

    async def create_indexes(self, indexes: list[IndexModel]) -> None:
        """An equivalent index under another name (codes 85/86) is tolerated."""
        if not indexes:
            return
        try:
            await self.collection.create_indexes(indexes)
        except OperationFailure as error:
            if error.code not in _INDEX_CONFLICT_CODES:
                raise
            LOGGER.warning("The collection %s already carries an equivalent index: %s", self.collection_name, error)

    async def drop_index_if_present(self, name: str) -> None:
        try:
            await self.collection.drop_index(name)
        except OperationFailure as error:
            if error.code not in _INDEX_MISSING_CODES:
                raise

    def _read(self, query: Query | None) -> Query:
        return alive(query) if self.soft_deletable else dict(query or {})

    async def find_one(self, query: Query) -> DocumentT | None:
        raw = await self.collection.find_one(self._read(query))
        return None if raw is None else self.document_type.model_validate(raw)

    async def find_by_id(self, identifier: str) -> DocumentT | None:
        return await self.find_one({ID: identifier})

    async def find_many(
        self,
        query: Query | None = None,
        sort: list[tuple[str, int]] | None = None,
        skip: int = 0,
        limit: int = 0,
        projection: dict[str, Any] | None = None,
    ) -> list[DocumentT]:
        cursor = self.collection.find(self._read(query), projection)
        if sort:
            cursor = cursor.sort(sort)
        if skip:
            cursor = cursor.skip(skip)
        if limit:
            cursor = cursor.limit(limit)
        return [self.document_type.model_validate(raw) async for raw in cursor]

    async def count(self, query: Query | None = None) -> int:
        return int(await self.collection.count_documents(self._read(query)))

    def _on_write(self) -> None:
        """Hook for repositories that cache reads."""

    async def insert(self, document: DocumentT) -> DocumentT:
        try:
            await self.collection.insert_one(document.model_dump(by_alias=True))
        except DuplicateKeyError as error:
            raise duplicate_conflict(error, self.collection_name) from error
        self._on_write()
        return document

    async def update_fields(self, identifier: str, updates: dict[str, Any]) -> bool:
        """`$set` (also on a deleted document); nothing is written for empty updates."""
        if not updates:
            return False
        try:
            result = await self.collection.update_one({ID: identifier}, {"$set": updates})
        except DuplicateKeyError as error:
            raise duplicate_conflict(error, self.collection_name) from error
        self._on_write()
        return bool(result.matched_count)

    async def delete(self, identifier: str, user: str | None) -> bool:
        """Soft delete; False when the document is missing or already deleted."""
        result = await self.collection.update_one(
            {ID: identifier, **NOT_DELETED},
            {"$set": {"deleted": True, "deleted_at": utc_now(), "deleted_by": user}},
        )
        self._on_write()
        return bool(result.matched_count)
