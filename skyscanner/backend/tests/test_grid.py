"""Grid configurations (built-ins, declared, discovered, vocabularies, version) and rows (filters, search, sort,
paging) against real documents."""

from typing import Any

import httpx

from tests.conftest import artifact, unique


async def seed(api: httpx.AsyncClient, industry: str) -> dict[str, Any]:
    level = unique("lvl")
    await api.post("/api/fields", json={"key": level, "name": "Level", "type": "number", "industry": industry})
    event_type = (
        await api.post("/api/types/events", json={"key": unique(), "name": "Flight", "custom_fields": [level]})
    ).json()
    entity_type = (await api.post("/api/types/entities", json={"key": unique(), "name": "Tel"})).json()
    created = []
    for index, (date, notes, value) in enumerate(
        [
            ("2026-09-07T22:30:00Z", "Alpha run", 1),
            ("2026-09-08T12:00:00Z", "beta RUN", 5),
            ("2026-09-10T08:00:00Z", None, 9),
        ]
    ):
        body: dict[str, Any] = {
            "industry": industry,
            "event_type_keys": [event_type["key"]],
            "name": f"event {index}",
            "event_date": date,
            "metadata": [{"key": level, "value": value}],
            "entities": [
                {
                    "name": f"ent{index}",
                    "entity_type_key": entity_type["key"],
                    "parsed_files": [artifact("p")] if index == 0 else [],
                }
            ],
            "additional_files": [artifact(f"file{index}.txt")],
        }
        if notes:
            body["notes"] = notes
        created.append((await api.post("/api/events", json=body)).json())
    return {"level": level, "events": created, "type": event_type}


async def rows(api: httpx.AsyncClient, industry: str, **query: Any) -> dict[str, Any]:
    response = await api.post("/api/grid/events/rows", json={"industries": [industry], **query})
    assert response.status_code == 200, response.text
    return dict(response.json())


async def names(api: httpx.AsyncClient, industry: str, *filters: dict[str, Any], **query: Any) -> list[str]:
    body = await rows(api, industry, filters=list(filters), sort=[{"key": "event_date", "direction": "asc"}], **query)
    return [row["name"] for row in body["rows"]]


async def test_rows_filters_search_sort_paging(api: httpx.AsyncClient, raw_db: Any, industry: str) -> None:
    seeded = await seed(api, industry)
    level = seeded["level"]
    page = await rows(api, industry, page=2, page_size=2, sort=[{"key": "event_date", "direction": "desc"}])
    assert page["total"] == 3 and page["pages"] == 2 and page["pageSize"] == 2
    assert [row["name"] for row in page["rows"]] == ["event 0"]
    row = page["rows"][0]
    assert row["data"] == {level: 1.0} and row["event_type_keys"] == [seeded["type"]["key"]]
    assert row["event_date"] == "2026-09-07T22:30:00Z"
    assert "objects" not in row

    day = {"key": "event_date", "operator": "equals", "value": "2026-09-08 00:00:00+03:00"}
    assert await names(api, industry, day) == ["event 0", "event 1"]
    assert await names(api, industry, {**day, "value": "2026-09-08 00:00:00"}) == ["event 1"]
    between = {"key": "event_date", "operator": "between", "values": ["2026-09-08 00:00:00Z", "2026-09-10 00:00:00Z"]}
    assert await names(api, industry, between) == ["event 1", "event 2"]
    assert await names(api, industry, {"key": level, "operator": "greater_or_equal", "value": 5}) == [
        "event 1",
        "event 2",
    ]
    assert await names(api, industry, {"key": f"data.{level}", "operator": "less_than", "value": 5}) == ["event 0"]
    assert await names(api, industry, {"key": "notes", "operator": "contains", "value": "RUN"}) == [
        "event 0",
        "event 1",
    ]
    assert await names(api, industry, {"key": "notes", "operator": "starts_with", "value": "beta"}) == ["event 1"]
    assert await names(api, industry, {"key": "notes", "operator": "is_empty"}) == ["event 2"]
    assert await names(api, industry, {"key": "name", "operator": "in", "values": ["event 2", "event 0"]}) == [
        "event 0",
        "event 2",
    ]
    assert await names(api, industry, {"key": "name", "operator": "not_in", "values": ["event 2"]}) == [
        "event 0",
        "event 1",
    ]
    identifier = seeded["events"][1]["id"]
    assert await names(api, industry, {"key": "id", "operator": "equals", "value": identifier}) == ["event 1"]
    type_key = seeded["type"]["key"]
    assert len(await names(api, industry, {"key": "event_type_keys", "operator": "in", "values": [type_key]})) == 3
    assert await names(api, industry, {"key": "objects.name", "operator": "equals", "value": "ent2"}) == ["event 2"]
    assert await names(api, industry, parse_state="parsed") == ["event 0"]
    assert await names(api, industry, parse_state="not_parsed") == ["event 1", "event 2"]
    assert await names(api, industry, search="file1.") == ["event 1"]
    assert await names(api, industry, search="a.l") == []

    search = await api.post("/api/events/search", json={"industries": [industry], "search": "alpha"})
    assert search.json()["total"] == 1 and search.json()["items"][0]["name"] == "event 0"
    listed = await api.get("/api/events", params={"industry": industry, "page_size": 2})
    assert listed.json()["pages"] == 2
    values = (await api.get("/api/grid/events/values/notes")).json()
    assert "Alpha run" in values


async def test_configuration(api: httpx.AsyncClient, raw_db: Any, industry: str) -> None:
    seeded = await seed(api, industry)
    platform = unique("p")
    await api.post("/api/platforms", json={"key": platform, "name": "Plat", "name_he": "פלט", "industries": [industry]})
    shared = unique("shared")
    await api.post(
        "/api/fields", json={"key": shared, "name": "Shared", "metadata": {"options": ["a", "b"], "name_he": "משותף"}}
    )
    stray = unique("stray")
    await raw_db.events.update_one({"_id": seeded["events"][0]["id"]}, {"$set": {f"data.{stray}": 3}})

    config = (await api.get("/api/grid/events/columns", params={"industries": [industry]})).json()
    assert config["industry"] == industry and config["scope"] == "event"
    columns = {column["colId"]: column for column in config["columns"]}
    level = columns[seeded["level"]]
    assert (
        level["field"] == f"data.{seeded['level']}" and level["filter"] == "agNumberColumnFilter" and level["dynamic"]
    )
    declared = columns[shared]
    assert (
        declared["filter"] == "SetColumnFilter" and declared["headerNameHebrew"] == "משותף" and declared["quickFilter"]
    )
    discovered = columns[stray]
    assert discovered["discovered"] and discovered["hide"] and discovered["fieldType"] == "integer"
    assert discovered["headerName"] == stray.title()
    platforms = columns["platforms"]
    assert {"value": platform, "label": "Plat", "labelHebrew": "פלט", "icon": ""} in platforms["filterOptions"]
    assert columns["event_type_names"]["filter"] == "SetColumnFilter"
    industries = columns["industry"]["filterOptions"]
    assert {"value": industry, "label": industry.upper(), "labelHebrew": "", "icon": "mdi-domain"} in industries

    hidden = (await api.get("/api/grid/events/columns", params={"industries": [industry], "discover": False})).json()
    assert stray not in {column["colId"] for column in hidden["columns"]}
    assert hidden["version"] != config["version"]

    entities = (await api.get("/api/grid/entities/columns", params={"industry": industry})).json()
    assert entities["scope"] == "entity"
    assert [column["colId"] for column in entities["columns"]][:3] == ["status", "name", "object_type_name"]
    parsed = next(column for column in entities["columns"] if column["colId"] == "parsed_files")
    assert parsed["field"] == "parsed_all_files"
