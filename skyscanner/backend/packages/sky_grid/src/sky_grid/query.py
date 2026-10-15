"""Translation of the grid's query model (filter conditions, sort, free text) into MongoDB.

Paths: a key named in `fixed` (or a dotted path below one) maps to its stored path, so `id` reaches `_id` and
`event_type_keys` the top-level list; a key already starting with `data.` is used as is; any other key addresses the
dynamic value `data.<key>`. Conditions are ANDed.

Dates: AG Grid sends a date filter as the text `YYYY-MM-DD 00:00:00` (optionally with an offset the client adds for
the reader's time zone). Such a "day" is matched as the whole day `[midnight, next midnight)` in that offset.
"""

import re
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from typing import Any

from sky_core.models.enums import SortDirection
from sky_core.models.query import FilterCondition, FilterOperator, SortSpecification
from sky_grid.constants import DYNAMIC_VALUE_ROOT

Query = dict[str, Any]
FixedKeys = Mapping[str, str]
"""Grid key -> stored path of the keys that are not dynamic values."""

EMPTY_VALUES: list[Any] = [None, "", []]
ASCENDING = 1
DESCENDING = -1
ONE_DAY = timedelta(days=1)
DAY_PATTERN = re.compile(r"^(\d{4}-\d{2}-\d{2})[ T]00:00:00(Z|[+-]\d{2}:\d{2})?$")
_DYNAMIC_PREFIX = f"{DYNAMIC_VALUE_ROOT}."
_DAY_OPERATORS = frozenset(
    {
        FilterOperator.EQUALS,
        FilterOperator.NOT_EQUALS,
        FilterOperator.GREATER_THAN,
        FilterOperator.GREATER_OR_EQUAL,
        FilterOperator.LESS_THAN,
        FilterOperator.LESS_OR_EQUAL,
    }
)
_TEXT_OPERATORS = frozenset(
    {FilterOperator.CONTAINS, FilterOperator.NOT_CONTAINS, FilterOperator.STARTS_WITH, FilterOperator.ENDS_WITH}
)
_COMPARISONS = {
    FilterOperator.NOT_EQUALS: "$ne",
    FilterOperator.GREATER_THAN: "$gt",
    FilterOperator.GREATER_OR_EQUAL: "$gte",
    FilterOperator.LESS_THAN: "$lt",
    FilterOperator.LESS_OR_EQUAL: "$lte",
}


def resolve_path(key: str, fixed: FixedKeys) -> str:
    if key in fixed:
        return fixed[key]
    if key.startswith(_DYNAMIC_PREFIX):
        return key
    head, dot, rest = key.partition(".")
    if dot and head in fixed:
        return f"{fixed[head]}.{rest}"
    return f"{_DYNAMIC_PREFIX}{key}"


def merge_filters(*filters: Query) -> Query:
    """AND of the non-empty filters (the single one as is)."""
    present = [candidate for candidate in filters if candidate]
    if not present:
        return {}
    return present[0] if len(present) == 1 else {"$and": present}


def build_text_search_filter(search: str, paths: list[str]) -> Query:
    """Literal, case-insensitive substring over `paths` (shallow paths first, which is cheaper)."""
    term = search.strip()
    if not term or not paths:
        return {}
    pattern = re.compile(re.escape(term), re.IGNORECASE)
    ordered = sorted(dict.fromkeys(paths), key=lambda path: path.count("."))
    return {"$or": [{path: pattern} for path in ordered]}


def build_mongo_filter(conditions: list[FilterCondition], fixed: FixedKeys) -> Query:
    return merge_filters(*(build_clause(condition, fixed) for condition in conditions))


def build_mongo_sort(specifications: list[SortSpecification], fixed: FixedKeys) -> list[tuple[str, int]]:
    return [
        (resolve_path(spec.key, fixed), ASCENDING if spec.direction is SortDirection.ASC else DESCENDING)
        for spec in specifications
    ]


def build_clause(condition: FilterCondition, fixed: FixedKeys) -> Query:
    """One condition; an incomplete condition (no value, too few values) restricts nothing."""
    path = resolve_path(condition.key, fixed)
    operator, value, values = condition.operator, condition.value, condition.values
    if operator is FilterOperator.IS_EMPTY:
        return {path: {"$in": EMPTY_VALUES}}
    if operator is FilterOperator.IS_NOT_EMPTY:
        return {path: {"$nin": EMPTY_VALUES}}
    if operator in (FilterOperator.IN, FilterOperator.NOT_IN):
        if not values:
            return {}
        return {path: {"$in" if operator is FilterOperator.IN else "$nin": list(values)}}
    if operator is FilterOperator.BETWEEN:
        return _between_clause(path, values)
    if value is None:
        return {}
    day = read_day(value) if operator in _DAY_OPERATORS else None
    if day is not None:
        return _day_clause(path, operator, day)
    if operator in _TEXT_OPERATORS:
        return _text_clause(path, operator, value)
    comparison = _COMPARISONS.get(operator)
    return {path: {comparison: value}} if comparison else {path: value}


def read_day(value: Any) -> datetime | None:
    """Midnight of a `YYYY-MM-DD 00:00:00[offset]` string, in UTC; None for anything else."""
    if not isinstance(value, str):
        return None
    match = DAY_PATTERN.match(value.strip())
    if match is None:
        return None
    offset = match.group(2)
    try:
        zone = UTC if offset in (None, "Z") else datetime.strptime(offset, "%z").tzinfo
        return datetime.fromisoformat(match.group(1)).replace(tzinfo=zone).astimezone(UTC)
    except ValueError:
        return None


def _between_clause(path: str, values: list[Any]) -> Query:
    if len(values) < 2:
        return {}
    first, last = read_day(values[0]), read_day(values[1])
    if first is not None and last is not None:
        return {path: {"$gte": first, "$lt": last + ONE_DAY}}
    return {path: {"$gte": values[0], "$lte": values[1]}}


def _day_clause(path: str, operator: FilterOperator, day: datetime) -> Query:
    next_day = day + ONE_DAY
    if operator is FilterOperator.NOT_EQUALS:
        return {"$or": [{path: {"$lt": day}}, {path: {"$gte": next_day}}]}
    ranges: dict[FilterOperator, Query] = {
        FilterOperator.GREATER_THAN: {"$gte": next_day},
        FilterOperator.GREATER_OR_EQUAL: {"$gte": day},
        FilterOperator.LESS_THAN: {"$lt": day},
        FilterOperator.LESS_OR_EQUAL: {"$lt": next_day},
    }
    return {path: ranges.get(operator, {"$gte": day, "$lt": next_day})}


def _text_clause(path: str, operator: FilterOperator, value: Any) -> Query:
    escaped = re.escape(str(value))
    if operator is FilterOperator.STARTS_WITH:
        escaped = f"^{escaped}"
    elif operator is FilterOperator.ENDS_WITH:
        escaped = f"{escaped}$"
    pattern = re.compile(escaped, re.IGNORECASE)
    return {path: {"$not": pattern}} if operator is FilterOperator.NOT_CONTAINS else {path: pattern}
