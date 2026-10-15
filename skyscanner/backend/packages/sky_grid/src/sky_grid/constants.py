"""Names the client resolves against its registries: filter components and cell renderers. The strings are the
contract with the client, so they never change."""

from enum import StrEnum

from sky_core.models.enums import FieldType


class GridFilter(StrEnum):
    TEXT = "agTextColumnFilter"
    NUMBER = "agNumberColumnFilter"
    DATE = "agDateColumnFilter"
    SET = "SetColumnFilter"


class CellRenderer(StrEnum):
    EVENT_LINK = "EventLinkCellRenderer"
    CHIP = "ChipCellRenderer"
    CHIP_LIST = "ChipListCellRenderer"
    STATUS = "StatusCellRenderer"
    DATE = "DateCellRenderer"
    FILES = "FilesCellRenderer"
    JSON = "JsonCellRenderer"
    BOOLEAN = "BooleanCellRenderer"
    TEXT = "TextCellRenderer"
    EXPAND = "ExpandCellRenderer"
    COORDINATE = "CoordinateCellRenderer"
    OPEN_EVENT = "OpenEventCellRenderer"


FIELD_TYPE_FILTERS: dict[FieldType, GridFilter | None] = {
    FieldType.STRING: GridFilter.TEXT,
    FieldType.TEXT: GridFilter.TEXT,
    FieldType.NUMBER: GridFilter.NUMBER,
    FieldType.INTEGER: GridFilter.NUMBER,
    FieldType.BOOLEAN: GridFilter.TEXT,
    FieldType.DATE: GridFilter.DATE,
    FieldType.DATETIME: GridFilter.DATE,
    FieldType.ENUM: GridFilter.TEXT,
    FieldType.FILE: None,
    FieldType.JSON: None,
    FieldType.COORDINATE: None,
}

FIELD_TYPE_RENDERERS: dict[FieldType, CellRenderer] = {
    FieldType.STRING: CellRenderer.TEXT,
    FieldType.TEXT: CellRenderer.TEXT,
    FieldType.NUMBER: CellRenderer.TEXT,
    FieldType.INTEGER: CellRenderer.TEXT,
    FieldType.BOOLEAN: CellRenderer.BOOLEAN,
    FieldType.DATE: CellRenderer.DATE,
    FieldType.DATETIME: CellRenderer.DATE,
    FieldType.ENUM: CellRenderer.CHIP,
    FieldType.FILE: CellRenderer.FILES,
    FieldType.JSON: CellRenderer.JSON,
    FieldType.COORDINATE: CellRenderer.COORDINATE,
}

DEFAULT_MIN_WIDTH = 120
DEFAULT_FLEX = 1
STAMP_CELL_CLASS = "sky-cell--stamp"
STAMP_HEADER_CLASS = "sky-header--stamp"
DYNAMIC_VALUE_ROOT = "data"
