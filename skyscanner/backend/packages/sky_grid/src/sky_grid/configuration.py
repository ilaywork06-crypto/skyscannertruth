"""Assembles a whole grid configuration and its version fingerprint.

Built-in columns come first (by `order`), then declared/discovered fields by `(order, name)`. The version hashes only
`colId:fieldType:hide`, so clients refresh cached layouts only when the columns really change.
"""

import hashlib
from collections.abc import Mapping

from sky_core.models.enums import FieldScope, SortDirection
from sky_core.models.field import FieldResponse
from sky_core.models.grid import ColumnDefinition, FilterOption, GridConfiguration
from sky_core.models.query import SortSpecification

from sky_grid.columns import BaseColumnSpec, column_from_field, column_from_spec

VERSION_LENGTH = 16
ROW_HEIGHT = 44
HEADER_HEIGHT = 44
QUICK_FILTER_TYPES = frozenset({"string", "text", "enum"})


def configuration_version(columns: list[ColumnDefinition]) -> str:
    signature = "|".join(f"{c.col_id}:{c.field_type}:{int(c.hide)}" for c in columns)
    return hashlib.sha256(signature.encode("utf-8")).hexdigest()[:VERSION_LENGTH]


def build_grid_configuration(
    scope: FieldScope,
    base_columns: list[BaseColumnSpec],
    declared_fields: list[FieldResponse],
    industry: str | None = None,
    default_sort_key: str = "created_at",
    vocabularies: Mapping[str, list[FilterOption]] | None = None,
) -> GridConfiguration:
    known = vocabularies or {}
    specs = [_with_options(spec, known) for spec in sorted(base_columns, key=lambda spec: spec.order)]
    columns = [column_from_spec(spec) for spec in specs]
    columns += [column_from_field(f) for f in sorted(declared_fields, key=lambda f: (f.order, f.name))]
    return GridConfiguration(
        scope=scope,
        industry=industry,
        columns=columns,
        default_sort=[SortSpecification(key=default_sort_key, direction=SortDirection.DESC)],
        quick_filter_keys=[c.field for c in columns if c.field_type in QUICK_FILTER_TYPES],
        row_height=ROW_HEIGHT,
        header_height=HEADER_HEIGHT,
        version=configuration_version(columns),
    )


def _with_options(spec: BaseColumnSpec, vocabularies: Mapping[str, list[FilterOption]]) -> BaseColumnSpec:
    if spec.options_source is None:
        return spec
    options = vocabularies.get(spec.options_source, [])
    return spec.model_copy(update={"options": list(options)}) if options else spec
