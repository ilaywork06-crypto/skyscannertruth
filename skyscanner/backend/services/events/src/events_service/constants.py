"""Names and fixed vocabularies of the events service: collections, type kinds, query keys and the built-in columns
of the events and entities grids (labels, renderers and widths are what the client renders)."""

from sky_core.models.enums import EntityStatus, ExperimentResult, FieldType, UploadSource
from sky_core.models.event import BRIEF_MAX_LENGTH
from sky_grid.columns import BaseColumnSpec, enum_options
from sky_grid.constants import STAMP_CELL_CLASS, STAMP_HEADER_CLASS, CellRenderer

SERVICE_NAME = "events-service"
SERVICE_VERSION = "0.2.0"
SERVICE_TITLE = "Skyscanner events service"
SERVICE_DESCRIPTION = "Inventory of every event, of the entities inside it and of the dynamic industry schema"
API_PREFIX = "/api"

EVENTS_COLLECTION = "events"
FIELDS_COLLECTION = "fields"
INDUSTRIES_COLLECTION = "industries"
TYPES_COLLECTION = "types"
PLATFORMS_COLLECTION = "platforms"
TEMPLATES_COLLECTION = "templates"
SUBSCRIPTIONS_COLLECTION = "subscriptions"
COUNTERS_COLLECTION = "counters"
OUTBOX_COLLECTION = "notification_outbox"
REVISIONS_COLLECTION = "revisions"

EVENT_TYPE_KIND = "event"
ENTITY_TYPE_KIND = "entity"
PLATFORM_TYPE_KIND = "platform"
"""Legacy: platforms used to live in `types`; the migrations move them out."""

EVENT_ID_COUNTER = "event_id"
ENTITY_FILTER_PREFIX = "objects."

EVENT_SEARCH_PATHS: list[str] = [
    "name",
    "notes",
    "industry",
    "platforms",
    "event_type_names",
    "objects.name",
    "objects.module",
    "objects.notes",
    "additional_files.name",
]

_SAME = (
    "event_id",
    "name",
    "event_type_names",
    "event_type_keys",
    "entity_counts",
    "industry",
    "platforms",
    "status",
    "experiment_result",
    "event_date",
    "created_at",
    "updated_at",
    "notes",
    "created_by",
    "updated_by",
    "upload_source",
    "additional_files",
)
FIXED_EVENT_KEYS: dict[str, str] = {"id": "_id", **{key: key for key in _SAME}}
"""Event grid keys that are stored as is. `id` addresses `_id`; any other key is a dynamic value (`data.<key>`)."""

FIXED_ENTITY_KEYS: dict[str, str] = {
    key: key
    for key in (
        "id",
        "object_id",
        "name",
        "object_type_name",
        "object_type_key",
        "module",
        "code_version",
        "status",
        "notes",
        "requested_at",
        "received_at",
        "created_at",
        "updated_at",
        "upload_source",
    )
}

PLATFORM_VOCABULARY = "platforms"
EVENT_TYPE_VOCABULARY = "event_types"
INDUSTRY_VOCABULARY = "industries"
ENTITY_TYPE_VOCABULARY = "entity_types"
MODULE_VOCABULARY = "modules"

ENUM_LABELS_HE: dict[str, str] = {
    "successful": "הצלחה",
    "partial": "חלקי",
    "failed": "כישלון",
    "raw": "גולמי",
    "parsing": "בפענוח",
    "partially_parsed": "פוענח חלקית",
    "parsed": "פוענח",
    "draft": "טיוטה",
    "operational": "מבצעי",
    "manual": "ידני",
    "watchdog": "Watchdog",
    "automation": "אוטומציה",
    "script": "סקריפט",
}

COMPACT_DATETIME_MIN_WIDTH = 132
_STAMP = {"cell_class": STAMP_CELL_CLASS, "header_class": STAMP_HEADER_CLASS}

EVENT_BASE_COLUMNS: list[BaseColumnSpec] = [
    BaseColumnSpec(
        col_id="event_date",
        field="event_date",
        header_name="EVENT DATE",
        header_name_he="תאריך האירוע",
        field_type=FieldType.DATETIME,
        renderer=CellRenderer.DATE,
        width=128,
        min_width=110,
        flex=None,
        order=10,
    ),
    BaseColumnSpec(
        col_id="event_type_names",
        field="event_type_names",
        header_name="EVENT TYPE",
        header_name_he="סוג אירוע",
        field_type=FieldType.ENUM,
        renderer=CellRenderer.CHIP_LIST,
        renderer_params={"palette": "hashed"},
        width=160,
        min_width=120,
        flex=None,
        order=20,
        options_source=EVENT_TYPE_VOCABULARY,
        quick_filter=True,
    ),
    BaseColumnSpec(
        col_id="name",
        field="name",
        header_name="DESCRIPTION",
        header_name_he="תיאור",
        renderer=CellRenderer.TEXT,
        renderer_params={"maxChars": BRIEF_MAX_LENGTH},
        width=390,
        min_width=200,
        flex=None,
        order=30,
    ),
    BaseColumnSpec(
        col_id="industry",
        field="industry",
        header_name="INDUSTRY",
        header_name_he="תעשייה",
        field_type=FieldType.ENUM,
        renderer=CellRenderer.CHIP,
        renderer_params={"palette": "industry"},
        width=150,
        min_width=110,
        flex=None,
        order=40,
        options_source=INDUSTRY_VOCABULARY,
    ),
    BaseColumnSpec(
        col_id="platforms",
        field="platforms",
        header_name="PLATFORM",
        header_name_he="פלטפורמה",
        field_type=FieldType.ENUM,
        renderer=CellRenderer.CHIP_LIST,
        renderer_params={"palette": "neutral"},
        width=150,
        min_width=110,
        flex=None,
        order=50,
        options_source=PLATFORM_VOCABULARY,
        quick_filter=True,
    ),
    BaseColumnSpec(
        col_id="event_id",
        field="event_id",
        header_name="ID",
        header_name_he="מזהה",
        field_type=FieldType.INTEGER,
        renderer=CellRenderer.EVENT_LINK,
        width=76,
        min_width=64,
        flex=None,
        order=60,
    ),
    BaseColumnSpec(
        col_id="experiment_result",
        field="experiment_result",
        header_name="RESULT",
        header_name_he="תוצאה",
        field_type=FieldType.ENUM,
        renderer=CellRenderer.STATUS,
        renderer_params={"palette": "experiment"},
        width=116,
        min_width=96,
        flex=None,
        order=70,
        options=enum_options(ExperimentResult, ENUM_LABELS_HE),
        quick_filter=True,
    ),
    BaseColumnSpec(
        col_id="notes",
        field="notes",
        header_name="INFO",
        header_name_he="מידע",
        field_type=FieldType.TEXT,
        renderer=CellRenderer.TEXT,
        min_width=140,
        flex=1.4,
        order=80,
    ),
    BaseColumnSpec(
        col_id="additional_files",
        field="additional_files",
        header_name="ADDITIONAL FILES",
        header_name_he="קבצים נוספים",
        field_type=FieldType.FILE,
        renderer=CellRenderer.FILES,
        min_width=170,
        flex=1,
        filterable=False,
        sortable=False,
        auto_height=True,
        order=90,
    ),
    BaseColumnSpec(
        col_id="updated_at",
        field="updated_at",
        header_name="UPDATED AT",
        header_name_he="עודכן",
        field_type=FieldType.DATETIME,
        renderer=CellRenderer.DATE,
        renderer_params={"withTime": True, "stamp": True},
        width=COMPACT_DATETIME_MIN_WIDTH,
        min_width=COMPACT_DATETIME_MIN_WIDTH,
        flex=None,
        order=100,
        **_STAMP,
    ),
    BaseColumnSpec(
        col_id="open",
        field="id",
        header_name="",
        header_name_he="",
        renderer=CellRenderer.OPEN_EVENT,
        width=48,
        min_width=None,
        flex=None,
        pinned="right",
        filterable=False,
        sortable=False,
        order=150,
    ),
]


def _entity_stamp(col_id: str, header: str, header_he: str, order: int, hide: bool = False) -> BaseColumnSpec:
    return BaseColumnSpec(
        col_id=col_id,
        field=col_id,
        header_name=header,
        header_name_he=header_he,
        field_type=FieldType.DATETIME,
        renderer=CellRenderer.DATE,
        renderer_params={"withTime": True, "stamp": True},
        min_width=COMPACT_DATETIME_MIN_WIDTH,
        flex=0.7,
        order=order,
        hide=hide,
        **_STAMP,
    )


ENTITY_BASE_COLUMNS: list[BaseColumnSpec] = [
    BaseColumnSpec(
        col_id="status",
        field="status",
        header_name="STATUS",
        header_name_he="סטטוס",
        field_type=FieldType.ENUM,
        renderer=CellRenderer.STATUS,
        min_width=110,
        order=20,
        options=enum_options(EntityStatus, ENUM_LABELS_HE),
    ),
    BaseColumnSpec(
        col_id="name",
        field="name",
        header_name="NAME",
        header_name_he="שם",
        renderer=CellRenderer.TEXT,
        min_width=130,
        order=30,
    ),
    BaseColumnSpec(
        col_id="object_type_name",
        field="object_type_name",
        header_name="ENTITY TYPE",
        header_name_he="סוג ישות",
        field_type=FieldType.ENUM,
        renderer=CellRenderer.TEXT,
        min_width=110,
        order=40,
        options_source=ENTITY_TYPE_VOCABULARY,
    ),
    BaseColumnSpec(
        col_id="module",
        field="module",
        header_name="MODULE",
        header_name_he="מודול",
        field_type=FieldType.ENUM,
        renderer=CellRenderer.CHIP,
        renderer_params={"palette": "neutral"},
        min_width=110,
        order=50,
        options_source=MODULE_VOCABULARY,
    ),
    BaseColumnSpec(
        col_id="code_version",
        field="code_version",
        header_name="CODE VERSION",
        header_name_he="גרסת קוד",
        renderer=CellRenderer.TEXT,
        min_width=110,
        order=60,
    ),
    BaseColumnSpec(
        col_id="raw_files",
        field="raw_files",
        header_name="RAW FILES",
        header_name_he="קבצים גולמיים",
        field_type=FieldType.FILE,
        renderer=CellRenderer.FILES,
        renderer_params={"flat": True},
        min_width=150,
        flex=1.2,
        filterable=False,
        sortable=False,
        auto_height=True,
        order=70,
    ),
    BaseColumnSpec(
        col_id="parsed_files",
        field="parsed_all_files",
        header_name="PARSED FILES",
        header_name_he="קבצים מפוענחים",
        field_type=FieldType.FILE,
        renderer=CellRenderer.FILES,
        renderer_params={"flat": True},
        min_width=150,
        flex=1.2,
        filterable=False,
        sortable=False,
        auto_height=True,
        order=80,
    ),
    BaseColumnSpec(
        col_id="files",
        field="files",
        header_name="ALL FILES",
        header_name_he="כל הקבצים",
        field_type=FieldType.FILE,
        renderer=CellRenderer.FILES,
        min_width=180,
        flex=1.4,
        hide=True,
        filterable=False,
        sortable=False,
        auto_height=True,
        order=90,
    ),
    BaseColumnSpec(
        col_id="notes",
        field="notes",
        header_name="NOTES",
        header_name_he="הערות",
        field_type=FieldType.TEXT,
        renderer=CellRenderer.TEXT,
        renderer_params={"display": "list"},
        min_width=120,
        order=100,
    ),
    _entity_stamp("created_at", "CREATED", "נוצר", 110),
    _entity_stamp("updated_at", "UPDATED", "עודכן", 120),
    _entity_stamp("requested_at", "REQUESTED", "התבקש", 130, hide=True),
    _entity_stamp("received_at", "RECEIVED", "התקבל", 140, hide=True),
    BaseColumnSpec(
        col_id="upload_source",
        field="upload_source",
        header_name="UPLOAD SOURCE",
        header_name_he="מקור ההעלאה",
        field_type=FieldType.ENUM,
        renderer=CellRenderer.CHIP,
        min_width=130,
        hide=True,
        order=150,
        options=enum_options(UploadSource, ENUM_LABELS_HE),
    ),
    BaseColumnSpec(
        col_id="created_by",
        field="created_by",
        header_name="CREATED BY",
        header_name_he="נוצר על ידי",
        renderer=CellRenderer.TEXT,
        min_width=120,
        hide=True,
        order=160,
    ),
    BaseColumnSpec(
        col_id="updated_by",
        field="updated_by",
        header_name="UPDATED BY",
        header_name_he="עודכן על ידי",
        renderer=CellRenderer.TEXT,
        min_width=120,
        hide=True,
        order=170,
    ),
]
