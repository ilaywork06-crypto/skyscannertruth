"""Shared enumerations. Their values are stored in MongoDB and travel on the wire, so they never change."""

from enum import StrEnum


class FieldType(StrEnum):
    STRING = "string"
    TEXT = "text"
    NUMBER = "number"
    INTEGER = "integer"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    ENUM = "enum"
    FILE = "file"
    JSON = "json"
    COORDINATE = "coordinate"


class FieldScope(StrEnum):
    EVENT = "event"
    ENTITY = "entity"


class EventStatus(StrEnum):
    DRAFT = "draft"
    OPERATIONAL = "operational"


class ExperimentResult(StrEnum):
    SUCCESSFUL = "successful"
    PARTIAL = "partial"
    FAILED = "failed"


class EntityStatus(StrEnum):
    RAW = "raw"
    PARSING = "parsing"
    PARTIALLY_PARSED = "partially_parsed"
    PARSED = "parsed"
    FAILED = "failed"


class OptionalEventField(StrEnum):
    EVENT_DATE = "event_date"
    EXPERIMENT_RESULT = "experiment_result"
    NOTES = "notes"


class ParseState(StrEnum):
    ALL = "all"
    PARSED = "parsed"
    NOT_PARSED = "not_parsed"


class DependencyOperator(StrEnum):
    HAS_VALUE = "has_value"
    IS_EMPTY = "is_empty"
    EQUALS = "equals"
    ONE_OF = "one_of"
    NOT_EQUALS = "not_equals"


class RevisionTarget(StrEnum):
    EVENT = "event"
    ENTITY = "entity"


class ArtifactKind(StrEnum):
    RAW = "raw"
    PARSED = "parsed"
    PARSED_ADDITIONAL = "parsed_additional"
    ADDITIONAL = "additional"


class UploadSource(StrEnum):
    MANUAL = "manual"
    WATCHDOG = "watchdog"
    AUTOMATION = "automation"
    SCRIPT = "script"


class Role(StrEnum):
    VIEWER = "viewer"
    EDITOR = "editor"
    ADMIN = "admin"


class Permission(StrEnum):
    EVENT_READ = "event:read"
    EVENT_CREATE = "event:create"
    EVENT_UPDATE = "event:update"
    EVENT_DELETE = "event:delete"
    ENTITY_MANAGE = "entity:manage"
    FILE_UPLOAD = "file:upload"
    FILE_DOWNLOAD = "file:download"
    FIELD_MANAGE = "field:manage"
    TEMPLATE_MANAGE = "template:manage"
    INDUSTRY_MANAGE = "industry:manage"
    SUBSCRIPTION_MANAGE = "subscription:manage"


class SortDirection(StrEnum):
    ASC = "asc"
    DESC = "desc"
