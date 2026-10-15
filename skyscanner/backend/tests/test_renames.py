"""Key renames carried through events, subscriptions, declarations and saved views, with dry-run counts."""

from typing import Any

import httpx

from tests.conftest import unique


async def test_field_rename_dry_run_then_apply(api: httpx.AsyncClient, raw_db: Any, industry: str) -> None:
    old, new = unique("f"), unique("g")
    field = (await api.post("/api/fields", json={"key": old, "name": "Depth", "type": "integer"})).json()
    event_type = (
        await api.post("/api/types/events", json={"key": unique(), "name": "T", "custom_fields": [old]})
    ).json()
    event = await api.post(
        "/api/events",
        json={
            "industry": industry,
            "event_type_keys": [event_type["key"]],
            "name": "x",
            "metadata": [{"key": old, "value": "4"}],
        },
    )
    assert event.status_code == 201, event.text
    view = {
        "name": unique("view"),
        "columns": [{"key": old, "width": 120}],
        "filters": [{"key": f"data.{old}", "operator": "greater_than", "value": 1}],
        "sort": [{"key": old, "direction": "asc"}],
    }
    template = (await api.post("/api/templates", json=view)).json()

    preview = (await api.get(f"/api/fields/{field['id']}/rename", params={"key": new})).json()
    assert preview == {"key": new, "previous_key": old, "affected": {"events": 1, "templates": 1, "types": 1}}
    assert (await raw_db.events.find_one({"_id": event.json()["id"]}))["data"] == {old: 4}

    renamed = await api.patch(f"/api/fields/{field['id']}", json={"key": new})
    assert renamed.json()["key"] == new
    stored = await raw_db.events.find_one({"_id": event.json()["id"]})
    assert stored["data"] == {new: 4}
    assert stored["metadata"][0]["key"] == new
    assert (await raw_db.types.find_one({"_id": event_type["id"]}))["custom_fields"] == [new]
    saved = await raw_db.templates.find_one({"_id": template["id"]})
    assert saved["columns"][0]["key"] == new
    assert saved["filters"][0]["key"] == f"data.{new}"
    assert saved["sort"][0]["key"] == new


async def test_event_type_and_platform_renames(api: httpx.AsyncClient, raw_db: Any, industry: str) -> None:
    old_type, new_type = unique("t"), unique("t")
    event_type = (await api.post("/api/types/events", json={"key": old_type, "name": "Old label"})).json()
    old_platform, new_platform = unique("p"), unique("p")
    platform = (await api.post("/api/platforms", json={"key": old_platform, "name": "P"})).json()
    event = (
        await api.post(
            "/api/events",
            json={"industry": industry, "event_type_keys": [old_type], "name": "x", "platforms": [old_platform]},
        )
    ).json()
    await api.post("/api/subscriptions", json={"email": "s@x.y", "event_type_key": old_type})
    view = (
        await api.post(
            "/api/templates",
            json={"name": unique("v"), "filters": [{"key": "platforms", "operator": "in", "values": [old_platform]}]},
        )
    ).json()

    preview = (await api.get(f"/api/types/{event_type['id']}/rename", params={"key": new_type})).json()
    assert preview["affected"] == {"events": 1, "subscriptions": 1, "templates": 0}
    taken = await api.post("/api/types/events", json={"key": new_type + "x", "name": "Other"})
    conflict = await api.patch(f"/api/types/events/{event_type['id']}", json={"key": taken.json()["key"]})
    assert conflict.status_code == 409
    await api.patch(f"/api/types/events/{event_type['id']}", json={"key": new_type, "name": "New label"})
    stored = await raw_db.events.find_one({"_id": event["id"]})
    assert stored["event_type_keys"] == [new_type]
    assert stored["event_type_names"] == ["New label"]
    assert await raw_db.subscriptions.count_documents({"event_type_key": new_type}) == 1

    preview = (await api.get(f"/api/platforms/{platform['id']}/rename", params={"key": new_platform})).json()
    assert preview["affected"] == {"events": 1, "templates": 1}
    await api.patch(f"/api/platforms/{platform['id']}", json={"key": new_platform})
    assert (await raw_db.events.find_one({"_id": event["id"]}))["platforms"] == [new_platform]
    assert (await raw_db.templates.find_one({"_id": view["id"]}))["filters"][0]["values"] == [new_platform]
    assert (await api.get(f"/api/platforms/{new_platform}")).status_code == 200


async def test_entity_type_rename(api: httpx.AsyncClient, raw_db: Any, industry: str) -> None:
    old, new = unique("e"), unique("e")
    entity_type = (await api.post("/api/types/entities", json={"key": old, "name": "E"})).json()
    event_type = (await api.post("/api/types/events", json={"key": unique(), "name": "T"})).json()
    await api.post("/api/fields", json={"key": unique(), "name": "F", "scope": "entity", "entity_type": old})
    event = (
        await api.post(
            "/api/events",
            json={
                "industry": industry,
                "event_type_keys": [event_type["key"]],
                "name": "x",
                "entities": [{"name": "a", "entity_type_key": old}],
            },
        )
    ).json()
    preview = (await api.get(f"/api/types/{entity_type['id']}/rename", params={"key": new})).json()
    assert preview["affected"] == {"events": 1, "fields": 1, "templates": 0}
    await api.patch(f"/api/types/entities/{entity_type['id']}", json={"key": new, "name": "Renamed"})
    stored = await raw_db.events.find_one({"_id": event["id"]})
    assert stored["entity_counts"] == {new: 1}
    assert stored["objects"][0]["object_type_key"] == new
    assert stored["objects"][0]["object_type_name"] == "Renamed"
