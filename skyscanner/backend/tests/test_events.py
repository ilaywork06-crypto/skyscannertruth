"""Events service integration: events, entities, revisions, outbox rows, soft delete, conflicts."""

from datetime import UTC, datetime
from typing import Any

import httpx

from events_service.domain.brief import fit_event_brief
from sky_core.models.enums import UploadSource
from tests.conftest import artifact, unique

EDITOR = {"X-Auth-User": "ed", "X-Auth-Roles": "editor"}


async def create_event(
    api: httpx.AsyncClient, industry: str, event_type: dict[str, Any], **extra: Any
) -> dict[str, Any]:
    body = {"industry": industry, "event_type_keys": [event_type["key"]], "name": "A brief", **extra}
    response = await api.post("/api/events", json=body)
    assert response.status_code == 201, response.text
    return dict(response.json())


async def outbox_rows(raw_db: Any, event_id: str) -> list[dict[str, Any]]:
    return [row async for row in raw_db.notification_outbox.find({"event_id": event_id}).sort("created_at", 1)]


async def test_create_event_rules(api: httpx.AsyncClient, industry: str, event_type: dict[str, Any]) -> None:
    no_type = await api.post("/api/events", json={"industry": industry, "name": "x"})
    assert no_type.json()["detail"] == "At least one event type has to be chosen"
    no_brief = await api.post("/api/events", json={"industry": industry, "event_type_keys": [event_type["key"]]})
    assert no_brief.status_code == 422
    assert no_brief.json()["details"] == {"field": "name"}
    unknown = await api.post("/api/events", json={"industry": industry, "event_type_keys": ["nope"], "name": "x"})
    assert unknown.status_code == 404
    assert unknown.json()["details"] == {"kind": "event", "key": "nope"}
    twice = [artifact("a.txt"), artifact("a.txt")]
    duplicate = await api.post(
        "/api/events",
        json={"industry": industry, "event_type_keys": [event_type["key"]], "name": "x", "additional_files": twice},
    )
    assert duplicate.json()["details"] == {"files": "a.txt", "attached_to": "the event"}
    too_long = await api.post(
        "/api/events", json={"industry": industry, "event_type_keys": [event_type["key"]], "name": "x" * 51}
    )
    assert too_long.status_code == 422


async def test_generated_brief_and_numbers(api: httpx.AsyncClient, industry: str, event_type: dict[str, Any]) -> None:
    first = await create_event(
        api, industry, event_type, name=None, upload_source="script", event_date="2026-08-27T10:00:00"
    )
    expected = fit_event_brief(
        [event_type["name"]],
        [],
        industry,
        datetime(2026, 8, 27, tzinfo=UTC),
        first["event_id"],
        50,
        UploadSource.SCRIPT,
    )
    assert first["name"] == expected
    assert expected.endswith(f"27 Aug 2026 · via script · #{first['event_id']}")
    assert first["event_date"].startswith("2026-08-27T10:00:00")
    second = await create_event(api, industry, event_type)
    assert second["event_id"] == first["event_id"] + 1


async def test_platforms_are_checked_against_the_industry(
    api: httpx.AsyncClient, industry: str, event_type: dict[str, Any]
) -> None:
    key = unique("plat")
    await api.post("/api/platforms", json={"key": key, "name": key, "industries": ["elsewhere"]})
    refused = await api.post(
        "/api/events",
        json={"industry": industry, "event_type_keys": [event_type["key"]], "name": "x", "platforms": [key]},
    )
    assert refused.status_code == 422
    assert refused.json()["details"] == {"platform": key, "industry": industry}


async def test_update_revisions_and_outbox(
    api: httpx.AsyncClient, raw_db: Any, industry: str, event_type: dict[str, Any]
) -> None:
    event = await create_event(api, industry, event_type, experiment_result="partial")
    same = await api.patch(f"/api/events/{event['id']}", json={"reason": "nothing", "notes": ""})
    assert same.status_code == 422
    assert same.json()["detail"] == "The request does not change anything about the event"
    blank = await api.patch(f"/api/events/{event['id']}", json={"reason": "r", "name": "  "})
    assert blank.status_code == 422
    updated = await api.patch(
        f"/api/events/{event['id']}",
        json={"reason": "fix", "notes": "new notes", "experiment_result": None},
        headers=EDITOR,
    )
    assert updated.status_code == 200
    assert updated.json()["experiment_result"] is None
    assert updated.json()["updated_by"] == "ed"
    revisions = (await api.get(f"/api/events/{event['id']}/revisions")).json()
    assert len(revisions) == 1
    assert revisions[0]["version"] == 1 and revisions[0]["reason"] == "fix" and revisions[0]["changed_by"] == "ed"
    assert {change["key"]: change["label"] for change in revisions[0]["changes"]} == {
        "experiment_result": "Experiment Result",
        "notes": "Notes",
    }
    rows = await outbox_rows(raw_db, event["id"])
    assert [row["trigger"] for row in rows] == ["event_created", "event_updated"]
    assert rows[0]["summary"] == f"A new {industry} event was uploaded by alice"
    assert rows[1]["summary"] == "The event was updated by ed: fix"
    assert rows[0]["event_number"] == event["event_id"] and rows[0]["attempts"] == 0 and rows[0]["processed_at"] is None


async def test_delete_is_soft(api: httpx.AsyncClient, raw_db: Any, industry: str, event_type: dict[str, Any]) -> None:
    event = await create_event(api, industry, event_type)
    removed = await api.delete(f"/api/events/{event['id']}")
    assert removed.json() == {"success": True, "message": "The event was removed", "affected": 1}
    assert (await api.get(f"/api/events/{event['id']}")).status_code == 404
    assert (await api.delete(f"/api/events/{event['id']}")).status_code == 404
    stored = await raw_db.events.find_one({"_id": event["id"]})
    assert stored["deleted"] is True and stored["deleted_by"] == "alice"


async def test_entities(
    api: httpx.AsyncClient, raw_db: Any, industry: str, event_type: dict[str, Any], entity_type: dict[str, Any]
) -> None:
    await api.patch(f"/api/industries/{industry}", json={"modules": ["radar"]})
    entity = {"name": "t1", "entity_type_key": entity_type["key"], "module": "radar"}
    event = await create_event(api, industry, event_type, entities=[entity])
    assert event["objects"][0]["object_id"] == 1 and event["entity_counts"] == {entity_type["key"]: 1}
    base = f"/api/events/{event['id']}/entities"
    bad_module = await api.post(base, json={**entity, "module": "sonar"})
    assert bad_module.json()["details"] == {"module": "sonar", "allowed": "radar"}
    not_parsed = await api.post(base, json={**entity, "status": "parsed"})
    assert not_parsed.json()["detail"] == "An entity cannot be marked as parsed while it carries no parsed files"
    same_name_roles = {**entity, "name": "t2", "raw_files": [artifact("f.bin")], "parsed_files": [artifact("f.bin")]}
    added = await api.post(base, json=same_name_roles)
    assert added.status_code == 201
    assert added.json()["object_id"] == 2 and added.json()["status"] == "parsed"
    duplicate = await api.post(base, json={**entity, "raw_files": [artifact("x"), artifact("x")]})
    assert duplicate.json()["details"]["attached_to"] == "the raw files of t1"

    first_id = event["objects"][0]["id"]
    updated = await api.patch(f"{base}/{first_id}", json={"reason": "parsed", "parsed_files": [artifact("p.csv")]})
    assert updated.json()["status"] == "parsed"
    back = await api.patch(f"{base}/{first_id}", json={"reason": "drop", "parsed_files": []})
    assert back.json()["status"] == "raw"
    assert (await api.delete(f"{base}/{added.json()['id']}")).json()["message"] == "The entity was removed"
    listed = (await api.get(base)).json()
    assert [item["name"] for item in listed] == ["t1"]
    third = await api.post(base, json={**entity, "name": "t3"})
    assert third.json()["object_id"] == 3

    history = (await api.get(f"/api/events/{event['id']}/revisions", params={"include_entities": True})).json()
    reasons = sorted(revision["reason"] for revision in history)
    assert reasons == sorted(
        [
            "The entity was attached to the event",
            "The entity was attached to the event",
            "parsed",
            "drop",
            "The entity was removed from the event",
        ]
    )
    entity_history = (await api.get(f"{base}/{first_id}/revisions")).json()
    assert [revision["version"] for revision in entity_history] == [2, 1]
    triggers = [row["trigger"] for row in await outbox_rows(raw_db, event["id"])]
    assert triggers == ["event_created", "entity_added", "entity_parsed", "entity_added"]
    stored = await raw_db.events.find_one({"_id": event["id"]})
    assert stored["entity_counts"] == {entity_type["key"]: 2}


async def test_recreating_a_deleted_key_is_a_conflict(api: httpx.AsyncClient) -> None:
    key = unique("plat")
    created = (await api.post("/api/platforms", json={"key": key, "name": key})).json()
    await api.delete(f"/api/platforms/{created['id']}")
    again = await api.post("/api/platforms", json={"key": key, "name": key})
    assert again.status_code == 409
    assert again.json()["error"] == "ConflictError"
    assert again.json()["details"]["collection"] == "platforms"


async def test_templates_and_subscriptions(api: httpx.AsyncClient) -> None:
    name = unique("view")
    created = await api.post("/api/templates", json={"name": name, "filters": [{"key": "name", "value": "x"}]})
    assert created.status_code == 201
    assert (await api.post("/api/templates", json={"name": name})).status_code == 409
    other = await api.patch(f"/api/templates/{created.json()['id']}", json={"name": "y"}, headers=EDITOR)
    assert other.status_code == 403
    second = await api.post("/api/templates", json={"name": unique("view")})
    renamed = await api.patch(f"/api/templates/{second.json()['id']}", json={"name": name})
    assert renamed.status_code == 409
    no_target = await api.post("/api/subscriptions", json={"email": "a@b.c"})
    assert no_target.status_code == 422
    single = await api.post("/api/subscriptions", json={"email": "a@b.c", "event_id": "e"})
    assert single.json()["details"] == {"event_id": "e"}
    target = {"email": "a@b.c", "industry": unique()}
    assert (await api.post("/api/subscriptions", json=target)).status_code == 201
    assert (await api.post("/api/subscriptions", json=target)).status_code == 409
    mine = (await api.get("/api/subscriptions")).json()
    assert any(item["industry"] == target["industry"] for item in mine)
