"""Exports of the current inventory view: CSV or JSON files, and the manifest of a zip of the attached files.

CSV/JSON are streamed (no 10,000 row cap any more). Because the columns are the union of the keys of every row, the
matching events are read twice: once to learn the columns, once to write the rows; memory stays bounded.

Row shape: the grid row flattened (dynamic values become top-level columns, lists are joined with ", ", objects
become their `name` or JSON text). CSV cells that a spreadsheet would run as a formula are prefixed with `'`.
"""

import csv
import io
import json
import textwrap
from collections.abc import AsyncIterator, Iterable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from pydantic_core import to_jsonable_python
from sky_core.clock import utc_now
from sky_core.models.common import Artifact
from sky_core.models.enums import EntityStatus
from sky_core.models.grid import EventExportRequest
from sky_core.models.storage import ArchiveEntry, ArchiveRequest
from sky_core.text import safe_path_segment

from events_service.documents import EntityDocument, EventDocument
from events_service.repositories.events import EventRepository
from events_service.services.grid import event_row

CSV_MEDIA_TYPE = "text/csv"
JSON_MEDIA_TYPE = "application/json"
JSON_FORMAT = "json"
ROWS_MODE = "rows"
STAMP_FORMAT = "%Y%m%dT%H%M%SZ"
MANIFEST_LIMIT = 10_000
LIST_JOIN = ", "
FORMULA_TRIGGERS = ("=", "+", "-", "@", "\t", "\r")
FILE_ROLES = (("raw", "raw_files"), ("parsed", "parsed_files"), ("parsed_additional", "parsed_additional_files"))

Row = dict[str, Any]


@dataclass(frozen=True)
class ExportFile:
    body: AsyncIterator[str]
    media_type: str
    file_name: str


def stamp() -> str:
    return utc_now().strftime(STAMP_FORMAT)


class ExportService:
    def __init__(self, events: EventRepository) -> None:
        self._events = events

    def export_events(self, request: EventExportRequest, export_format: str, entity_mode: str) -> ExportFile:
        if export_format.lower() == JSON_FORMAT:
            return ExportFile(self._json(request), JSON_MEDIA_TYPE, f"skyscanner-events-{stamp()}.json")
        per_entity = entity_mode.lower() == ROWS_MODE
        return ExportFile(self._csv(request, per_entity), CSV_MEDIA_TYPE, f"skyscanner-events-{stamp()}.csv")

    async def build_archive_manifest(self, request: EventExportRequest) -> ArchiveRequest:
        """Every attached file of the live entities, as `event-<n>-<brief>/<entity type>/<entity>/<role>/<name>`."""
        entries: list[ArchiveEntry] = []
        folders: list[str] = []
        async for document in self._documents(request, limit=MANIFEST_LIMIT):
            folder = safe_path_segment(f"event-{document.event_id}-{document.name}")
            folders.append(folder)
            entries += _entries_for(document.additional_files, f"{folder}/additional_files")
            for entity in document.live_objects:
                base = f"{folder}/{safe_path_segment(entity.object_type_name)}/{safe_path_segment(entity.name)}"
                for _, role in FILE_ROLES:
                    entries += _entries_for(getattr(entity, role), f"{base}/{role}")
        name = folders[0] if len(folders) == 1 else "skyscanner-files"
        return ArchiveRequest(entries=entries, archive_name=f"{name}-{stamp()}.zip")

    def _documents(self, request: EventExportRequest, limit: int = 0) -> AsyncIterator[EventDocument]:
        return self._events.iterate(request, request.event_ids or None, limit)

    async def _json(self, request: EventExportRequest) -> AsyncIterator[str]:
        selected = request.columns or await self._collect_keys(request)
        written = 0
        async for document in self._documents(request):
            row = flatten(event_row(document))
            item = {
                **{key: row.get(key) for key in selected},
                "entities": [_entity_payload(e) for e in document.live_objects],
            }
            text = textwrap.indent(json.dumps(item, indent=2, default=str), "  ")
            yield ("[\n" if written == 0 else ",\n") + text
            written += 1
        yield "\n]" if written else "[]"

    async def _csv(self, request: EventExportRequest, per_entity: bool) -> AsyncIterator[str]:
        all_keys: dict[str, None] = {}
        entity_keys: dict[str, None] = {}
        async for document in self._documents(request):
            for event, extra in _csv_rows(document, per_entity):
                all_keys.update(dict.fromkeys(event))
                all_keys.update(dict.fromkeys(extra))
                entity_keys.update(dict.fromkeys(extra))
        columns = request.columns
        selected = [*columns, *(key for key in entity_keys if key not in columns)] if columns else list(all_keys)
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=selected, extrasaction="ignore")
        writer.writeheader()
        yield _drain(buffer)
        async for document in self._documents(request):
            for event, extra in _csv_rows(document, per_entity):
                row = {**event, **extra}
                writer.writerow({key: _inert(row.get(key, "")) for key in selected})
            yield _drain(buffer)

    async def _collect_keys(self, request: EventExportRequest) -> list[str]:
        keys: dict[str, None] = {}
        async for document in self._documents(request):
            keys.update(dict.fromkeys(flatten(event_row(document))))
        return list(keys)


def _drain(buffer: io.StringIO) -> str:
    text = buffer.getvalue()
    buffer.seek(0)
    buffer.truncate()
    return text


def _csv_rows(document: EventDocument, per_entity: bool) -> list[tuple[Row, Row]]:
    """`(event columns, entity columns)` per CSV row: one per event (summary) or one per live entity (rows)."""
    event = flatten(event_row(document))
    entities = document.live_objects
    if not per_entity:
        return [(event, _entity_summary(entities))]
    if not entities:
        return [(event, {})]
    return [(event, _entity_columns(entity)) for entity in entities]


def flatten(row: Row) -> Row:
    """Dynamic values become top-level columns (and may shadow a fixed one); `metadata`/`event_type` are dropped."""
    flat: Row = {}
    for key, value in row.items():
        if key == "data" and isinstance(value, dict):
            flat.update({dynamic: stringify(item) for dynamic, item in value.items()})
        elif key not in {"metadata", "event_type"}:
            flat[key] = stringify(value)
    return flat


def stringify(value: Any) -> Any:
    """Lists (of anything, numbers included) are joined; objects become their name or JSON text."""
    if isinstance(value, list):
        return LIST_JOIN.join("" if item is None else str(stringify(item)) for item in value)
    if isinstance(value, dict):
        return str(value.get("name", json.dumps(value, default=str)))
    return value


def _inert(value: Any) -> Any:
    """Defuses spreadsheet formulas, leaving negative numbers alone."""
    if not isinstance(value, str) or not value.startswith(FORMULA_TRIGGERS):
        return value
    try:
        float(value)
    except ValueError:
        return f"'{value}"
    return value


def _unique(values: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def _entity_summary(entities: list[EntityDocument]) -> Row:
    counts = dict.fromkeys(EntityStatus, 0)
    for entity in entities:
        counts[entity.status] += 1
    summary: Row = {
        "entities_count": len(entities),
        "entities_names": LIST_JOIN.join(entity.name for entity in entities),
        "entities_types": LIST_JOIN.join(_unique(entity.object_type_name for entity in entities)),
        "entities_modules": LIST_JOIN.join(_unique(entity.module or "" for entity in entities)),
        "entities_file_count": sum(len(getattr(entity, role)) for entity in entities for _, role in FILE_ROLES),
    }
    summary.update({f"entities_status_{status.value}": counts[status] for status in EntityStatus})
    return summary


def _entity_columns(entity: EntityDocument) -> Row:
    columns: Row = {
        "entity_id": entity.object_id,
        "entity_name": entity.name,
        "entity_type": entity.object_type_name,
        "entity_module": entity.module or "",
        "entity_status": entity.status.value,
        "entity_code_version": entity.code_version or "",
        "entity_notes": entity.notes,
        "entity_created_by": entity.created_by or "",
        "entity_created_at": _moment(entity.created_at),
        "entity_updated_at": _moment(entity.updated_at),
    }
    for label, role in FILE_ROLES:
        files: list[Artifact] = getattr(entity, role)
        columns[f"entity_{label}_files"] = LIST_JOIN.join(artifact.name for artifact in files)
        columns[f"entity_{label}_file_count"] = len(files)
    columns.update({f"entity_data_{key}": stringify(value) for key, value in entity.data.items()})
    return columns


def _entity_payload(entity: EntityDocument) -> Row:
    return {
        "entity_id": entity.object_id,
        "name": entity.name,
        "type": entity.object_type_name,
        "module": entity.module,
        "status": entity.status.value,
        "code_version": entity.code_version,
        "notes": entity.notes,
        "upload_source": entity.upload_source.value,
        "files": {
            label: {"count": len(files), "names": [artifact.name for artifact in files]}
            for label, files in ((label, getattr(entity, role)) for label, role in FILE_ROLES)
        },
        "data": to_jsonable_python(entity.data),
        "created_by": entity.created_by,
        "created_at": _moment(entity.created_at),
        "updated_at": _moment(entity.updated_at),
    }


def _moment(value: datetime | None) -> str:
    return value.isoformat() if value else ""


def _entries_for(files: list[Artifact], folder: str) -> list[ArchiveEntry]:
    """Repeated names in one folder become `name`, `1-name`, `2-name`..."""
    entries: list[ArchiveEntry] = []
    seen: dict[str, int] = {}
    for artifact in files:
        name = safe_path_segment(artifact.name)
        count = seen.get(name, 0)
        seen[name] = count + 1
        entries.append(ArchiveEntry(path=artifact.path, entry=f"{folder}/{name if count == 0 else f'{count}-{name}'}"))
    return entries
