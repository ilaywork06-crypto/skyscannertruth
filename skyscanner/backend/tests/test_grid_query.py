"""sky_grid: path resolution, filter translation (whole days included), sort, free text, configuration version."""

import re
from datetime import UTC, datetime

from events_service.constants import EVENT_BASE_COLUMNS, FIXED_EVENT_KEYS
from sky_core.models.enums import FieldScope
from sky_core.models.query import FilterCondition, SortSpecification
from sky_grid.configuration import build_grid_configuration, configuration_version
from sky_grid.query import build_clause, build_mongo_filter, build_mongo_sort, build_text_search_filter, resolve_path


def clause(key: str, operator: str, value: object = None, values: list[object] | None = None) -> dict[str, object]:
    condition = FilterCondition(key=key, operator=operator, value=value, values=values or [])
    return build_clause(condition, FIXED_EVENT_KEYS)


def test_paths() -> None:
    assert resolve_path("name", FIXED_EVENT_KEYS) == "name"
    assert resolve_path("id", FIXED_EVENT_KEYS) == "_id"
    assert resolve_path("event_type_keys", FIXED_EVENT_KEYS) == "event_type_keys"
    assert resolve_path("entity_counts.telemetry", FIXED_EVENT_KEYS) == "entity_counts.telemetry"
    assert resolve_path("sample_rate", FIXED_EVENT_KEYS) == "data.sample_rate"
    assert resolve_path("data.sample_rate", FIXED_EVENT_KEYS) == "data.sample_rate"


def test_day_operators_cover_whole_days() -> None:
    day = datetime(2026, 9, 7, 21, tzinfo=UTC)
    next_day = datetime(2026, 9, 8, 21, tzinfo=UTC)
    assert clause("event_date", "equals", "2026-09-08 00:00:00+03:00") == {"event_date": {"$gte": day, "$lt": next_day}}
    assert clause("event_date", "greater_than", "2026-09-08T00:00:00+03:00") == {"event_date": {"$gte": next_day}}
    assert clause("event_date", "less_or_equal", "2026-09-08 00:00:00+03:00") == {"event_date": {"$lt": next_day}}
    utc_day = datetime(2026, 9, 8, tzinfo=UTC)
    assert clause("event_date", "not_equals", "2026-09-08 00:00:00") == {
        "$or": [{"event_date": {"$lt": utc_day}}, {"event_date": {"$gte": datetime(2026, 9, 9, tzinfo=UTC)}}]
    }
    between = clause("event_date", "between", values=["2026-09-01 00:00:00Z", "2026-09-08 00:00:00Z"])
    assert between == {
        "event_date": {"$gte": datetime(2026, 9, 1, tzinfo=UTC), "$lt": datetime(2026, 9, 9, tzinfo=UTC)}
    }
    assert clause("event_date", "equals", "2026-09-08") == {"event_date": "2026-09-08"}


def test_other_operators() -> None:
    assert clause("n", "is_empty") == {"data.n": {"$in": [None, "", []]}}
    assert clause("n", "is_not_empty") == {"data.n": {"$nin": [None, "", []]}}
    assert clause("n", "in") == {}
    assert clause("n", "not_in", values=[1]) == {"data.n": {"$nin": [1]}}
    assert clause("n", "between", values=[1]) == {}
    assert clause("n", "between", values=[1, 5]) == {"data.n": {"$gte": 1, "$lte": 5}}
    assert clause("n", "greater_than", 3) == {"data.n": {"$gt": 3}}
    assert clause("n", "equals", None) == {}
    assert clause("n", "equals", 3) == {"data.n": 3}
    starts = clause("name", "starts_with", "a.b")
    assert starts["name"] == re.compile(r"^a\.b", re.IGNORECASE)
    assert clause("name", "not_contains", "x") == {"name": {"$not": re.compile("x", re.IGNORECASE)}}


def test_combination_sort_and_search() -> None:
    conditions = [FilterCondition(key="a", value=1), FilterCondition(key="b", value=2)]
    assert build_mongo_filter(conditions, FIXED_EVENT_KEYS) == {"$and": [{"data.a": 1}, {"data.b": 2}]}
    assert build_mongo_sort(
        [SortSpecification(key="id", direction="asc"), SortSpecification(key="x")], FIXED_EVENT_KEYS
    ) == [
        ("_id", 1),
        ("data.x", -1),
    ]
    search = build_text_search_filter("  a+b ", ["objects.name", "name", "name"])
    assert search == {
        "$or": [{"name": re.compile(r"a\+b", re.IGNORECASE)}, {"objects.name": re.compile(r"a\+b", re.IGNORECASE)}]
    }
    assert build_text_search_filter("  ", ["name"]) == {}


def test_configuration_built_ins_and_version() -> None:
    configuration = build_grid_configuration(FieldScope.EVENT, EVENT_BASE_COLUMNS, [])
    body = configuration.model_dump(by_alias=True)
    assert [column["colId"] for column in body["columns"]][:3] == ["event_date", "event_type_names", "name"]
    assert body["rowHeight"] == 44 and body["headerHeight"] == 44
    assert body["defaultSort"] == [{"key": "created_at", "direction": "desc"}]
    assert body["version"] == configuration_version(configuration.columns)
    assert len(body["version"]) == 16
    result = next(column for column in body["columns"] if column["colId"] == "experiment_result")
    assert result["filter"] == "SetColumnFilter" and result["quickFilter"] is True
    assert result["filterOptions"][0] == {
        "value": "successful",
        "label": "Successful",
        "labelHebrew": "הצלחה",
        "icon": "",
    }
    types = next(column for column in body["columns"] if column["colId"] == "event_type_names")
    assert types["filter"] == "agTextColumnFilter" and types["quickFilter"] is False
