"""Edit history: which tracked values an edit moves.

Documents are flattened to `{key: jsonable value}` over the tracked keys plus every `data.<key>`. File lists compare
by file names only, so re-uploading a file under the same name (new path/size) is not a change. The same comparison
refuses no-op edits before they are written.
"""

from collections.abc import Mapping
from typing import Any

from pydantic_core import to_jsonable_python
from sky_core.models.revision import FieldChange
from sky_core.text import humanize_key

from events_service.documents import EntityDocument, EventDocument

DYNAMIC_PREFIX = "data."
TRACKED_EVENT_KEYS = (
    "name",
    "industry",
    "platforms",
    "status",
    "experiment_result",
    "event_date",
    "notes",
    "event_type_names",
    "additional_files",
)
TRACKED_ENTITY_KEYS = (
    "name",
    "module",
    "code_version",
    "status",
    "notes",
    "requested_at",
    "received_at",
    "raw_files",
    "parsed_files",
    "parsed_additional_files",
)
FILE_KEYS = frozenset({"additional_files", "raw_files", "parsed_files", "parsed_additional_files"})

State = dict[str, Any]


def flatten_event(document: EventDocument) -> State:
    return _flatten(document, TRACKED_EVENT_KEYS)


def flatten_entity(document: EntityDocument) -> State:
    return _flatten(document, TRACKED_ENTITY_KEYS)


def _flatten(document: EventDocument | EntityDocument, tracked: tuple[str, ...]) -> State:
    state = {key: _readable(key, getattr(document, key, None)) for key in tracked}
    state.update({f"{DYNAMIC_PREFIX}{key}": value for key, value in document.data.items()})
    return state


def _readable(key: str, value: Any) -> Any:
    if key in FILE_KEYS and isinstance(value, list):
        return [getattr(item, "name", str(item)) for item in value]
    return to_jsonable_python(value)


def build_changes(before: Mapping[str, Any], after: Mapping[str, Any]) -> list[FieldChange]:
    """One change per key (sorted) whose value differs; a key missing on one side reads as None."""
    return [
        FieldChange(
            key=key,
            label=label_of(key),
            before=to_jsonable_python(before.get(key)),
            after=to_jsonable_python(after.get(key)),
        )
        for key in sorted(set(before) | set(after))
        if before.get(key) != after.get(key)
    ]


def label_of(key: str) -> str:
    return humanize_key(key.removeprefix(DYNAMIC_PREFIX))


def event_update_changes(document: EventDocument, updates: Mapping[str, Any]) -> list[FieldChange]:
    prospective = EventDocument.model_validate({**document.model_dump(by_alias=True), **updates})
    return build_changes(flatten_event(document), flatten_event(prospective))


def entity_update_changes(document: EntityDocument, updates: Mapping[str, Any]) -> list[FieldChange]:
    prospective = EntityDocument.model_validate({**document.model_dump(by_alias=True), **updates})
    return build_changes(flatten_entity(document), flatten_entity(prospective))
