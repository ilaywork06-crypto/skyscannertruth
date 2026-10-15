"""Dynamic values: every key written into `metadata`/`data` must follow a declared field.

`build_values` turns the supplied `MetadataAttribute`s into the two stored forms:
- declared keys: skipped when their dependencies do not hold; required when on the form; defaulted; coerced to the
  declared type; validated against the constraints (unless resent unchanged);
- undeclared keys: refused, except keys the document already carried (`carried`), which are kept as they are;
- empty values (None, "", []) of undeclared keys are dropped.
Output order: declared keys in declaration order, then the carried undeclared ones in supplied order.
"""

import math
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from pydantic import ValidationError as PydanticValidationError

from events_service.documents import FieldDocument
from sky_core.clock import ensure_utc
from sky_core.errors import ValidationError
from sky_core.models.common import Coordinate, MetadataAttribute
from sky_core.models.enums import DependencyOperator, FieldScope, FieldType
from sky_core.models.field import FieldDependency

TRUE_VALUES = frozenset({"true", "1", "yes", "on"})
FALSE_VALUES = frozenset({"false", "0", "no", "off"})
TEXT_TYPES = frozenset({FieldType.STRING, FieldType.TEXT, FieldType.ENUM})
MOMENT_TYPES = frozenset({FieldType.DATE, FieldType.DATETIME})


@dataclass(frozen=True)
class ValueRequest:
    """What a write supplies and what it may keep.

    `asked`: keys on the form (None = every declaration); `carried`: undeclared keys already stored, which may be
    resent; `previous`: stored values, so an unchanged value is not re-validated; `context`: values dependencies may
    read when the form itself lacks them (the event's values for an entity).
    """

    scope: FieldScope
    supplied: list[MetadataAttribute]
    context: Mapping[str, Any] | None = None
    asked: set[str] | None = None
    carried: set[str] = field(default_factory=set)
    previous: Mapping[str, Any] | None = None


def build_values(
    declarations: list[FieldDocument], request: ValueRequest
) -> tuple[list[MetadataAttribute], dict[str, Any]]:
    by_key = {declaration.key: declaration for declaration in declarations}
    supplied = {attribute.key: attribute for attribute in request.supplied}
    supplied_values = {key: attribute.value for key, attribute in supplied.items()}
    attributes: list[MetadataAttribute] = []
    flattened: dict[str, Any] = {}
    for key, declaration in by_key.items():
        on_form = request.asked is None or key in request.asked
        if not on_form and key not in supplied:
            continue
        if not dependencies_hold(declaration.depends_on, supplied_values, request.context):
            continue
        raw_value = supplied[key].value if key in supplied else declaration.default
        if is_empty(raw_value):
            if declaration.required and on_form:
                raise ValidationError(f"The field {declaration.name} is required", {"key": key})
            continue
        stored = coerce(declaration, raw_value)
        previous = request.previous
        if previous is None or key not in previous or previous[key] != stored:
            check_constraints(declaration, stored)
        flattened[key] = stored
        attributes.append(MetadataAttribute(key=key, value=to_json_value(stored), type=declaration.type))
    undeclared = [key for key, attribute in supplied.items() if key not in by_key and not is_empty(attribute.value)]
    _require_declared(undeclared, request.carried, request.scope)
    for key in undeclared:
        flattened[key] = supplied[key].value
        attributes.append(supplied[key].model_copy())
    return attributes, flattened


def _require_declared(keys: list[str], allowed: set[str], scope: FieldScope) -> None:
    refused = sorted(key for key in keys if key not in allowed)
    if refused:
        raise ValidationError(
            "Every value has to follow a field declared on the Schema page",
            {"keys": ", ".join(refused), "scope": scope.value},
        )


def is_empty(value: Any) -> bool:
    return value is None or value in ("", [])


def dependencies_hold(
    dependencies: list[FieldDependency], values: Mapping[str, Any], context: Mapping[str, Any] | None = None
) -> bool:
    """All must hold. A key present on the form (even empty) wins over the context. No coercion is applied."""
    return all(_dependency_holds(dependency, values, context) for dependency in dependencies)


def _dependency_holds(
    dependency: FieldDependency, values: Mapping[str, Any], context: Mapping[str, Any] | None
) -> bool:
    other = values[dependency.field] if dependency.field in values else (context or {}).get(dependency.field)
    filled = not is_empty(other)
    if dependency.operator is DependencyOperator.HAS_VALUE:
        return filled
    if dependency.operator is DependencyOperator.IS_EMPTY:
        return not filled
    if dependency.operator is DependencyOperator.NOT_EQUALS:
        return other not in dependency.values
    return other in dependency.values


def coerce(declaration: FieldDocument, value: Any) -> Any:
    """The stored form of `value`; a list field wraps a single value."""
    if declaration.array:
        candidates = value if isinstance(value, list) else [value]
        return [_coerce_single(declaration, candidate) for candidate in candidates]
    return _coerce_single(declaration, value)


def _coerce_single(declaration: FieldDocument, value: Any) -> Any:
    field_type = declaration.type
    try:
        if field_type in TEXT_TYPES:
            return str(value)
        if field_type is FieldType.INTEGER:
            return _coerce_integer(value)
        if field_type is FieldType.NUMBER:
            return _coerce_number(value)
        if field_type is FieldType.BOOLEAN:
            return _coerce_boolean(value)
        if field_type in MOMENT_TYPES:
            return _coerce_datetime(value)
        if field_type is FieldType.COORDINATE:
            return _coerce_coordinate(value)
    except (TypeError, ValueError, PydanticValidationError) as error:
        raise ValidationError(
            f"The value of {declaration.name} is not a valid {field_type.value}", {"key": declaration.key}
        ) from error
    return value


def _coerce_number(value: Any) -> float:
    if isinstance(value, bool):
        raise TypeError(f"{value} is not a number")
    number = float(value)
    if not math.isfinite(number):
        raise ValueError(f"{value} is not a finite number")
    return number


def _coerce_integer(value: Any) -> int:
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    if isinstance(value, str) and value.strip().lstrip("+-").isdigit():
        return int(value)
    number = _coerce_number(value)
    if not number.is_integer():
        raise ValueError(f"{value} is not a whole number")
    return int(number)


def _coerce_boolean(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    lowered = str(value).strip().lower()
    if lowered in TRUE_VALUES:
        return True
    if lowered in FALSE_VALUES:
        return False
    raise ValueError(f"{value} is not a truth value")


def _coerce_datetime(value: Any) -> datetime:
    """Dates are stored as full UTC datetimes."""
    parsed = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    converted = ensure_utc(parsed)
    assert converted is not None
    return converted


def _coerce_coordinate(value: Any) -> dict[str, Any]:
    if isinstance(value, list | tuple):
        if len(value) not in {2, 3}:
            raise ValueError(f"{value} is not a coordinate")
        lon, lat, *rest = value
        return Coordinate(lon=float(lon), lat=float(lat), alt=float(rest[0]) if rest else None).model_dump()
    if isinstance(value, Mapping):
        return Coordinate.model_validate(dict(value)).model_dump()
    raise ValueError(f"{value} is not a coordinate")


def check_constraints(declaration: FieldDocument, value: Any) -> None:
    if declaration.type is FieldType.ENUM and declaration.metadata.options:
        for candidate in value if isinstance(value, list) else [value]:
            if str(candidate) not in declaration.metadata.options:
                raise ValidationError(
                    f"The value of {declaration.name} is not one of the allowed options",
                    {"key": declaration.key, "value": str(candidate)},
                )
    for constraint in declaration.constraints:
        if not _satisfies(constraint.name, constraint.value, value):
            raise ValidationError(
                constraint.message or f"The value of {declaration.name} breaks the rule {constraint.name}",
                {"key": declaration.key, "constraint": constraint.name},
            )


def _satisfies(name: str, limit: Any, value: Any) -> bool:
    """`min`/`max` apply to numbers only; lengths measure the text form (of a list too); unknown rules pass."""
    if limit is None:
        return True
    is_number = isinstance(value, int | float)
    if name == "min" and is_number:
        return bool(value >= float(limit))
    if name == "max" and is_number:
        return bool(value <= float(limit))
    if name == "min_length":
        return len(str(value)) >= int(limit)
    if name == "max_length":
        return len(str(value)) <= int(limit)
    if name == "pattern":
        return re.fullmatch(str(limit), str(value)) is not None
    return True


def to_json_value(value: Any) -> Any:
    """The `metadata` form: datetimes as ISO text (`+00:00`)."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [to_json_value(item) for item in value]
    return value
