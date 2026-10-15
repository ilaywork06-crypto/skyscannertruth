"""Column definitions: built-in columns from `BaseColumnSpec`, dynamic ones from field declarations."""

from collections.abc import Iterable, Mapping
from enum import Enum

from pydantic import BaseModel, ConfigDict, JsonValue

from sky_core.models.enums import FieldType
from sky_core.models.field import FieldResponse
from sky_core.models.grid import ColumnDefinition, FilterOption
from sky_core.text import humanize_key
from sky_grid.constants import (
    DEFAULT_FLEX,
    DEFAULT_MIN_WIDTH,
    DYNAMIC_VALUE_ROOT,
    FIELD_TYPE_FILTERS,
    FIELD_TYPE_RENDERERS,
    CellRenderer,
    GridFilter,
)


class BaseColumnSpec(BaseModel):
    """A built-in column. `options_source` names a vocabulary filled in at request time."""

    model_config = ConfigDict(populate_by_name=True)
    col_id: str
    field: str
    header_name: str
    header_name_he: str = ""
    field_type: FieldType = FieldType.STRING
    renderer: CellRenderer | None = None
    renderer_params: dict[str, JsonValue] = {}
    filterable: bool = True
    sortable: bool = True
    hide: bool = False
    flex: float | None = DEFAULT_FLEX
    min_width: float | None = DEFAULT_MIN_WIDTH
    max_width: float | None = None
    width: float | None = None
    pinned: str | None = None
    auto_height: bool = False
    order: int = 10
    cell_class: str | None = None
    header_class: str | None = None
    options: list[FilterOption] = []
    options_source: str | None = None
    quick_filter: bool = False


def enum_options(members: Iterable[Enum], hebrew_labels: Mapping[str, str]) -> list[FilterOption]:
    """One option per member: the value, its humanized label and its Hebrew label."""
    return [
        FilterOption(value=str(m.value), label=humanize_key(str(m.value)), label_he=hebrew_labels.get(str(m.value), ""))
        for m in members
    ]


def resolve_filter(field_type: FieldType, filterable: bool, options: list[FilterOption]) -> str | bool:
    """No filter when not filterable, the set filter when a vocabulary exists, else the type's filter."""
    if not filterable:
        return False
    if options:
        return GridFilter.SET.value
    chosen = FIELD_TYPE_FILTERS.get(field_type, GridFilter.TEXT)
    return chosen.value if chosen is not None else False


def column_from_spec(spec: BaseColumnSpec) -> ColumnDefinition:
    return ColumnDefinition(
        col_id=spec.col_id,
        field=spec.field,
        header_name=spec.header_name,
        header_name_he=spec.header_name_he,
        sortable=spec.sortable,
        filter=resolve_filter(spec.field_type, spec.filterable, spec.options),
        hide=spec.hide,
        flex=spec.flex,
        min_width=spec.min_width,
        max_width=spec.max_width,
        width=spec.width,
        pinned=spec.pinned,
        cell_renderer=(spec.renderer or FIELD_TYPE_RENDERERS[spec.field_type]).value,
        cell_renderer_params=dict(spec.renderer_params),
        header_class=spec.header_class,
        cell_class=spec.cell_class,
        auto_height=spec.auto_height,
        field_type=spec.field_type.value,
        filter_options=list(spec.options),
        quick_filter=spec.quick_filter and bool(spec.options),
    )


def column_from_field(definition: FieldResponse) -> ColumnDefinition:
    """A declared (or discovered) field: its values live under `data.<key>` in the row."""
    metadata = definition.metadata
    options = [FilterOption(value=option, label=option) for option in metadata.options]
    return ColumnDefinition(
        col_id=definition.key,
        field=f"{DYNAMIC_VALUE_ROOT}.{definition.key}",
        header_name=definition.name,
        header_name_he=metadata.name_he or "",
        sortable=definition.sortable and not definition.array,
        filter=resolve_filter(definition.type, definition.filterable, options),
        hide=not definition.visible,
        flex=DEFAULT_FLEX,
        min_width=DEFAULT_MIN_WIDTH,
        cell_renderer=FIELD_TYPE_RENDERERS[definition.type].value,
        cell_renderer_params={"unit": metadata.unit, "array": definition.array, "options": list(metadata.options)},
        auto_height=definition.type is FieldType.FILE,
        field_type=definition.type.value,
        dynamic=True,
        discovered=definition.discovered,
        industry=definition.industry,
        filter_options=options,
        quick_filter=bool(options) and not definition.discovered,
    )
