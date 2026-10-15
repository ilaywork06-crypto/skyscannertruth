"""Idempotent document migrations, run at every start before the indexes are built.

They bring databases written by older versions to the current shapes:
1. entity `origin` -> `module`, industry `entity_origins` -> `modules`;
2. event `platform` (one string) -> `platforms` (list), declaring each seen platform as a legacy platform type;
3. type `industry` (one value) -> `industries` (list); event types without `fields` get the legacy default;
4. platforms declared in `types` are copied into `platforms`; the originals are soft deleted (kept for rollback).
"""

from typing import Any

from events_service.constants import (
    EVENT_TYPE_KIND,
    EVENTS_COLLECTION,
    INDUSTRIES_COLLECTION,
    PLATFORM_TYPE_KIND,
    PLATFORMS_COLLECTION,
    TYPES_COLLECTION,
)
from sky_core.clock import utc_now
from sky_core.log import get_logger
from sky_core.models.enums import OptionalEventField
from sky_core.mongo import MongoProvider

LOGGER = get_logger(__name__)
LEGACY_TYPE_FIELDS = [OptionalEventField.EVENT_DATE.value, OptionalEventField.NOTES.value]
LEGACY_PLATFORM_DESCRIPTION = "Declared from the platforms the stored events already named"


async def migrate_documents(provider: MongoProvider) -> None:
    await _rename_entity_origins(provider)
    await _widen_platforms(provider)
    await _widen_declaration_industries(provider)
    await _move_platforms_out_of_the_types(provider)


async def _rename_entity_origins(provider: MongoProvider) -> None:
    without_origin = {
        "$arrayToObject": {
            "$filter": {"input": {"$objectToArray": "$$entity"}, "as": "pair", "cond": {"$ne": ["$$pair.k", "origin"]}}
        }
    }
    pipeline: list[dict[str, Any]] = [
        {
            "$set": {
                "objects": {
                    "$map": {
                        "input": "$objects",
                        "as": "entity",
                        "in": {"$mergeObjects": [without_origin, {"module": "$$entity.origin"}]},
                    }
                }
            }
        }
    ]
    renamed = await provider.collection(EVENTS_COLLECTION).update_many({"objects.origin": {"$exists": True}}, pipeline)
    vocabularies = await provider.collection(INDUSTRIES_COLLECTION).update_many(
        {"entity_origins": {"$exists": True}}, {"$rename": {"entity_origins": "modules"}}
    )
    if renamed.modified_count or vocabularies.modified_count:
        LOGGER.info(
            "Renamed the origin of %s events and the vocabulary of %s industries to module",
            renamed.modified_count,
            vocabularies.modified_count,
        )


async def _widen_platforms(provider: MongoProvider) -> None:
    events = provider.collection(EVENTS_COLLECTION)
    types = provider.collection(TYPES_COLLECTION)
    stored = await events.distinct("platform", {"platform": {"$nin": [None, ""]}})
    names = sorted({value for value in stored if isinstance(value, str) and value})
    for name in names:
        industries = await events.distinct("industry", {"platform": name})
        declaration = {
            "_id": f"platform-{name}",
            "name": name,
            "description": LEGACY_PLATFORM_DESCRIPTION,
            "icon": None,
            "industries": sorted({value for value in industries if isinstance(value, str)}),
            "fields": [],
            "order": 100,
            "deleted": False,
            "created_at": utc_now(),
        }
        await types.update_one({"kind": PLATFORM_TYPE_KIND, "key": name}, {"$setOnInsert": declaration}, upsert=True)
    pipeline: list[dict[str, Any]] = [
        {"$set": {"platforms": {"$cond": [{"$in": ["$platform", [None, ""]]}, [], ["$platform"]]}}},
        {"$unset": "platform"},
    ]
    result = await events.update_many({"platform": {"$exists": True}}, pipeline)
    if result.modified_count:
        LOGGER.info("Carried %s events onto a list of platforms", result.modified_count)


async def _widen_declaration_industries(provider: MongoProvider) -> None:
    types = provider.collection(TYPES_COLLECTION)
    pipeline: list[dict[str, Any]] = [
        {"$set": {"industries": {"$cond": [{"$eq": ["$industry", None]}, [], ["$industry"]]}}},
        {"$unset": "industry"},
    ]
    widened = await types.update_many({"industry": {"$exists": True}}, pipeline)
    filled = await types.update_many(
        {"kind": EVENT_TYPE_KIND, "fields": {"$exists": False}}, {"$set": {"fields": LEGACY_TYPE_FIELDS}}
    )
    if widened.modified_count or filled.modified_count:
        LOGGER.info("Widened %s declarations and filled %s event types", widened.modified_count, filled.modified_count)


async def _move_platforms_out_of_the_types(provider: MongoProvider) -> None:
    types = provider.collection(TYPES_COLLECTION)
    platforms = provider.collection(PLATFORMS_COLLECTION)
    legacy = {"kind": PLATFORM_TYPE_KIND, "deleted": {"$ne": True}}
    carried = 0
    async for stored in types.find(legacy):
        copy = {
            "key": stored.get("key", ""),
            "name": stored.get("name", ""),
            "description": stored.get("description", ""),
            "industries": list(stored.get("industries", [])),
            "order": int(stored.get("order") or 100),
            "deleted": False,
            "created_at": stored.get("created_at", utc_now()),
        }
        await platforms.update_one({"_id": stored["_id"]}, {"$setOnInsert": copy}, upsert=True)
        carried += 1
    if carried:
        await types.update_many(legacy, {"$set": {"deleted": True, "deleted_at": utc_now(), "deleted_by": "migration"}})
        LOGGER.info("Carried %d platforms out of the types and into their own collection", carried)
