"""Exports: CSV (summary and per-entity rows, numeric lists), JSON, files manifest, and the bundle round trip."""

import csv
import io
import json
import zipfile
from typing import Any

import httpx
from asgi_lifespan import LifespanManager

from events_service.main import create_app as create_events_app
from sky_core.settings import MongoSettings
from tests.conftest import ADMIN, MONGO_URI, bundle_storage, unique


async def seed(api: httpx.AsyncClient, industry: str) -> dict[str, Any]:
    numbers = unique("nums")
    await api.post("/api/fields", json={"key": numbers, "name": "Numbers", "type": "number", "array": True})
    event_type = (await api.post("/api/types/events", json={"key": unique(), "name": "Flight"})).json()
    entity_type = (await api.post("/api/types/entities", json={"key": unique(), "name": "Tel"})).json()
    event = await api.post(
        "/api/events",
        json={
            "industry": industry,
            "event_type_keys": [event_type["key"]],
            "name": "=cmd",
            "notes": "-5",
            "metadata": [{"key": numbers, "value": [1, 2.5]}],
            "entities": [
                {"name": "a", "entity_type_key": entity_type["key"], "module": "m1"},
                {"name": "b", "entity_type_key": entity_type["key"], "status": "failed"},
            ],
        },
    )
    assert event.status_code == 201, event.text
    return {"numbers": numbers, "event": event.json()}


async def test_csv_and_json(api: httpx.AsyncClient, industry: str) -> None:
    seeded = await seed(api, industry)
    response = await api.post("/api/exports/events", json={"industries": [industry]})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.headers["content-disposition"].startswith('attachment; filename="skyscanner-events-')
    table = list(csv.DictReader(io.StringIO(response.text)))
    assert len(table) == 1
    row = table[0]
    assert row[seeded["numbers"]] == "1.0, 2.5"
    assert row["name"] == "'=cmd" and row["notes"] == "-5"
    assert row["entities_count"] == "2" and row["entities_names"] == "a, b" and row["entities_modules"] == "m1"
    assert row["entities_status_failed"] == "1" and row["entities_status_raw"] == "1"

    per_entity = await api.post(
        "/api/exports/events", params={"entity_mode": "rows"}, json={"industries": [industry], "columns": ["event_id"]}
    )
    table = list(csv.DictReader(io.StringIO(per_entity.text)))
    assert [entry["entity_name"] for entry in table] == ["a", "b"]
    assert list(table[0])[:3] == ["event_id", "entity_id", "entity_name"]

    exported = await api.post(
        "/api/exports/events", params={"export_format": "JSON"}, json={"event_ids": [seeded["event"]["id"]]}
    )
    assert exported.headers["content-type"].startswith("application/json")
    payload = json.loads(exported.text)
    assert payload[0]["id"] == seeded["event"]["id"]
    assert [entity["name"] for entity in payload[0]["entities"]] == ["a", "b"]
    assert payload[0]["entities"][0]["files"]["raw"] == {"count": 0, "names": []}
    empty = await api.post("/api/exports/events", params={"export_format": "json"}, json={"event_ids": ["none"]})
    assert empty.text == "[]"


async def test_files_manifest(api: httpx.AsyncClient, industry: str) -> None:
    event_type = (await api.post("/api/types/events", json={"key": unique(), "name": "T"})).json()
    files = [{"id": "1", "name": "r.txt", "path": "p/1"}, {"id": "2", "name": "r.txt", "path": "p/2", "folder": "f"}]
    event = (
        await api.post(
            "/api/events",
            json={
                "industry": industry,
                "event_type_keys": [event_type["key"]],
                "name": "a/b",
                "additional_files": files,
            },
        )
    ).json()
    manifest = (await api.post("/api/exports/events/files", json={"event_ids": [event["id"]]})).json()
    folder = f"event-{event['event_id']}-a_b"
    assert manifest["entries"] == [
        {"path": "p/1", "entry": f"{folder}/additional_files/r.txt"},
        {"path": "p/2", "entry": f"{folder}/additional_files/1-r.txt"},
    ]
    assert manifest["archive_name"].startswith(folder) and manifest["documents"] == []


async def test_bundle_round_trip_into_an_empty_database(
    api: httpx.AsyncClient, storage_client: httpx.AsyncClient, industry: str
) -> None:
    uploaded = await storage_client.post("/api/storage/artifacts", files={"files": ("notes.txt", b"bundle me")})
    stored = uploaded.json()["artifacts"][0]
    await api.post("/api/platforms", json={"key": unique("plat"), "name": "unused"})
    field = unique("fld")
    await api.post("/api/fields", json={"key": field, "name": "F", "industry": industry})
    event_type = (
        await api.post("/api/types/events", json={"key": unique(), "name": "T", "custom_fields": [field]})
    ).json()
    event = (
        await api.post(
            "/api/events",
            json={
                "industry": industry,
                "event_type_keys": [event_type["key"]],
                "name": "bundled",
                "additional_files": [stored],
                "metadata": [{"key": field, "value": "v"}],
            },
        )
    ).json()

    manifest = (await api.post("/api/exports/events/bundle", json={"event_ids": [event["id"]]})).json()
    assert manifest["documents"][0]["entry"] == "manifest.json"
    archive = await storage_client.post("/api/storage/artifacts/archive", json=manifest)
    assert archive.status_code == 200
    with zipfile.ZipFile(io.BytesIO(archive.content)) as bundle:
        content = json.loads(bundle.read("manifest.json"))
        assert content["format"] == "skyscanner.inventory.bundle"
        assert [item["key"] for item in content["industries"]] == [industry]
        assert [item["key"] for item in content["fields"]] == [field]
        assert any(name.startswith("files/") and name.endswith(".txt") for name in bundle.namelist())

    empty = MongoSettings(MONGO_URI=MONGO_URI, MONGO_DATABASE=unique("skytest_empty_"))
    target = create_events_app(empty, bundle_storage(storage_client))
    try:
        async with (
            LifespanManager(target),
            httpx.AsyncClient(
                transport=httpx.ASGITransport(app=target), base_url="http://target", headers=ADMIN
            ) as other,
        ):
            files = {"file": ("bundle.zip", archive.content, "application/zip")}
            imported = await other.post("/api/imports/events", files=files)
            assert imported.status_code == 201, imported.text
            summary = imported.json()
            assert summary["failures"] == []
            assert summary["events_created"] == 1 and summary["files_restored"] == 1
            assert (
                summary["industries_created"] == 1 and summary["types_created"] == 1 and summary["fields_created"] == 1
            )
            restored = (await other.get(f"/api/events/{event['id']}")).json()
            assert restored["event_id"] == event["event_id"] and restored["name"] == "bundled"
            new_file = restored["additional_files"][0]
            assert new_file["path"] != stored["path"] and new_file["name"] == "notes.txt"
            content_response = await storage_client.get(
                "/api/storage/artifacts/content", params={"path": new_file["path"]}
            )
            assert content_response.content == b"bundle me"
            again = (await other.post("/api/imports/events", files=files)).json()
            assert again["events_skipped"] == 1 and again["events_created"] == 0
            industry_type = (await other.post("/api/types/events", json={"key": unique(), "name": "N"})).json()
            fresh = await other.post(
                "/api/events", json={"industry": industry, "event_type_keys": [industry_type["key"]], "name": "after"}
            )
            assert fresh.json()["event_id"] == event["event_id"] + 1
            refused = await other.post("/api/imports/events", files={"file": ("x.zip", b"not a zip")})
            assert refused.status_code == 422 and refused.json()["detail"] == "The uploaded file is not an archive"
    finally:
        client: Any = __import__("pymongo").MongoClient(MONGO_URI)
        client.drop_database(empty.database)
        client.close()
