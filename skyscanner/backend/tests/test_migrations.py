"""Startup on a database written by older versions: migrations, indexes, and reading the legacy shapes."""

from datetime import UTC, datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

from events_service.bootstrap import prepare_database
from events_service.repositories.declarations import FieldRepository
from events_service.repositories.events import EventRepository
from sky_core.models.enums import FieldScope
from sky_core.mongo import MongoProvider
from sky_core.settings import MongoSettings
from tests.conftest import MONGO_URI, unique


async def test_legacy_documents_are_migrated_and_readable() -> None:
    settings = MongoSettings(MONGO_URI=MONGO_URI, MONGO_DATABASE=unique("skytest_legacy_"))
    client: AsyncIOMotorClient[dict[str, Any]] = AsyncIOMotorClient(MONGO_URI, tz_aware=True)
    db: Any = client[settings.database]
    now = datetime(2026, 1, 1, tzinfo=UTC)
    entity = {"id": "e1", "object_type": {"id": "t", "name": "T"}, "origin": "radar", "created_at": now}
    await db.events.insert_one(
        {
            "_id": "ev1",
            "event_id": 1,
            "name": "old",
            "industry": "air",
            "platform": "falcon",
            "objects": [entity],
            "created_at": now,
        }
    )
    await db.industries.insert_one({"_id": "i1", "key": "air", "name": "Air", "entity_origins": ["radar"], "icon": ""})
    await db.types.insert_one({"_id": "t1", "kind": "event", "key": "exp", "name": "Exp", "industry": "air"})
    await db.fields.insert_one({"_id": "f1", "name": "F", "key": "depth", "scope": "event", "industry": "air"})
    provider = MongoProvider(settings)
    try:
        await provider.connect()
        await prepare_database(provider)
        await prepare_database(provider)
        event = await db.events.find_one({"_id": "ev1"})
        assert event["platforms"] == ["falcon"] and "platform" not in event
        assert event["objects"][0]["module"] == "radar" and "origin" not in event["objects"][0]
        assert (await db.industries.find_one({"_id": "i1"}))["modules"] == ["radar"]
        event_type = await db.types.find_one({"_id": "t1"})
        assert event_type["industries"] == ["air"] and event_type["fields"] == ["event_date", "notes"]
        platform = await db.platforms.find_one({"_id": "platform-falcon"})
        assert platform["key"] == "falcon" and platform["industries"] == ["air"]
        legacy_type = await db.types.find_one({"_id": "platform-falcon"})
        assert legacy_type["deleted"] is True and legacy_type["deleted_by"] == "migration"
        indexes = await db.events.index_information()
        assert {"event_id_unique", "industry_created", "dynamic_depth"} <= set(indexes)
        document = await EventRepository(provider).find_by_id("ev1")
        assert document is not None and document.objects[0].module == "radar"
        fields = await FieldRepository(provider).list_for_scope(FieldScope.EVENT, "air", additional=False)
        assert [field.key for field in fields] == ["depth"] and fields[0].additional is False
    finally:
        provider.close()
        await client.drop_database(settings.database)
        client.close()
