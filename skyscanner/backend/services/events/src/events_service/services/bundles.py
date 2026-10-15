"""Bundles: a zip holding `manifest.json` (the exported events with every declaration they reference) and their
files, which another inventory can import.

Export returns the archive manifest that the client posts to the storage service, which streams the zip. Whole stored
documents are exported, soft-deleted entities and their files included.

Import runs three passes and never aborts on one failure (each becomes a `failures` entry):
1. declarations (industries, platforms, types, fields) that do not exist yet, keeping their ids;
2. files of the events that will be imported, uploaded through the storage service;
3. events, as stored (no validation, revision or notification); an existing live event is skipped, an id held by a
   deleted event gets a new id, the event number is kept when free, and the counter is lifted past the highest one.
"""

import hashlib
import io
import json
import zipfile
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from typing import Any

from pydantic import BaseModel
from pydantic_core import to_jsonable_python
from sky_core.clock import utc_now
from sky_core.ids import new_id
from sky_core.models.common import Artifact, UserContext
from sky_core.models.grid import EventExportRequest
from sky_core.models.storage import ArchiveDocument, ArchiveEntry, ArchiveRequest
from sky_core.text import file_suffix

from events_service.constants import ENTITY_TYPE_KIND, EVENT_ID_COUNTER, EVENT_TYPE_KIND
from events_service.documents import EventDocument, FieldDocument, IndustryDocument, PlatformDocument, TypeDocument
from events_service.repositories.declarations import (
    FieldRepository,
    IndustryRepository,
    PlatformRepository,
    TypeRepository,
)
from events_service.repositories.events import EventRepository
from events_service.repositories.records import CounterRepository
from events_service.services.storage_client import StorageClient, StoredFile

BUNDLE_FORMAT = "skyscanner.inventory.bundle"
BUNDLE_VERSION = 1
MANIFEST_ENTRY = "manifest.json"
BUNDLE_LIMIT = 10_000
MAX_BUNDLE_BYTES = 8 * 1024**3
PATH_HASH_LENGTH = 16
FILE_ROLES = ("raw_files", "parsed_files", "parsed_additional_files")
Raw = dict[str, Any]


@dataclass
class ImportSummary:
    events_created: int = 0
    events_skipped: int = 0
    industries_created: int = 0
    types_created: int = 0
    platforms_created: int = 0
    fields_created: int = 0
    files_restored: int = 0
    failures: list[str] = field(default_factory=list)

    def as_payload(self) -> dict[str, Any]:
        return asdict(self)


class BundleService:
    def __init__(
        self,
        events: EventRepository,
        industries: IndustryRepository,
        types: TypeRepository,
        platforms: PlatformRepository,
        fields: FieldRepository,
        counters: CounterRepository,
        storage: StorageClient,
    ) -> None:
        self._events = events
        self._industries = industries
        self._types = types
        self._platforms = platforms
        self._fields = fields
        self._counters = counters
        self._storage = storage

    # ----- export ----- #

    async def build_bundle(self, request: EventExportRequest) -> ArchiveRequest:
        documents = [doc async for doc in self._events.iterate(request, request.event_ids or None, BUNDLE_LIMIT)]
        files = _collect_files(documents)
        manifest = {
            "format": BUNDLE_FORMAT,
            "version": BUNDLE_VERSION,
            "created_at": utc_now().isoformat(),
            "industries": _dump(await self._referenced_industries(documents)),
            "types": _dump(await self._referenced_types(documents)),
            "platforms": _dump(await self._referenced_platforms(documents)),
            "fields": _dump(await self._referenced_fields(documents)),
            "events": _dump(documents),
            "files": files,
        }
        return ArchiveRequest(
            entries=[ArchiveEntry(path=path, entry=entry) for path, entry in files.items()],
            documents=[ArchiveDocument(entry=MANIFEST_ENTRY, content=json.dumps(manifest, indent=2, default=str))],
            archive_name=f"skyscanner-bundle-{utc_now().strftime('%Y%m%dT%H%M%SZ')}.zip",
        )

    async def _referenced_industries(self, documents: list[EventDocument]) -> list[IndustryDocument]:
        keys = sorted({document.industry for document in documents if document.industry})
        return [found for key in keys if (found := await self._industries.find_by_key(key))]

    async def _referenced_platforms(self, documents: list[EventDocument]) -> list[PlatformDocument]:
        keys = sorted({key for document in documents for key in document.platforms if key})
        return [found for key in keys if (found := await self._platforms.find_by_key(key))]

    async def _referenced_types(self, documents: list[EventDocument]) -> list[TypeDocument]:
        event_keys = sorted({key for document in documents for key in document.event_type_keys if key})
        entity_keys = sorted(
            {entity.object_type_key for document in documents for entity in document.live_objects} - {""}
        )
        wanted = [(EVENT_TYPE_KIND, key) for key in event_keys] + [(ENTITY_TYPE_KIND, key) for key in entity_keys]
        return [found for kind, key in wanted if (found := await self._types.find_by_key(kind, key))]

    async def _referenced_fields(self, documents: list[EventDocument]) -> list[FieldDocument]:
        keys = {key for document in documents for key in document.data}
        keys.update(key for document in documents for entity in document.live_objects for key in entity.data)
        return await self._fields.with_keys(sorted(keys))

    # ----- import ----- #

    async def restore_bundle(self, payload: bytes, user: UserContext) -> dict[str, Any]:
        """Raises `ValueError` when the payload is not a readable bundle."""
        summary = ImportSummary()
        try:
            archive = zipfile.ZipFile(io.BytesIO(payload))
        except zipfile.BadZipFile as error:
            raise ValueError("The uploaded file is not an archive") from error
        with archive:
            manifest = _read_manifest(archive)
            await self._restore_declarations(manifest, summary)
            events = _documents_of(manifest, "events")
            present = await self._events.live_ids([i for event in events if isinstance(i := _event_id(event), str)])
            needed = {
                path
                for event in events
                if _event_id(event) not in present
                for record in _raw_artifacts_of(event)
                if isinstance(path := record.get("path"), str)
            }
            restored = await self._restore_files(archive, manifest, needed, user, summary)
            await self._restore_events(events, restored, summary)
        return summary.as_payload()

    async def _restore_declarations(self, manifest: Raw, summary: ImportSummary) -> None:
        for raw in _documents_of(manifest, "industries"):
            if await self._restore_one(raw, "industry", summary, self._new_industry):
                summary.industries_created += 1
        for raw in _documents_of(manifest, "platforms"):
            if await self._restore_one(raw, "platform", summary, self._new_platform):
                summary.platforms_created += 1
        for raw in _documents_of(manifest, "types"):
            if await self._restore_one(raw, "type", summary, self._new_type):
                summary.types_created += 1
        for raw in _documents_of(manifest, "fields"):
            if await self._restore_one(raw, "field", summary, self._new_field):
                summary.fields_created += 1

    @staticmethod
    async def _restore_one(raw: Raw, label: str, summary: ImportSummary, restore: Any) -> bool:
        try:
            return bool(await restore(raw))
        except Exception as error:
            summary.failures.append(f"{label} {raw.get('key', '?')}: {error}")
            return False

    async def _new_industry(self, raw: Raw) -> bool:
        document = IndustryDocument.model_validate(raw)
        if await self._industries.find_by_key(document.key) is not None:
            return False
        await self._industries.insert(document)
        return True

    async def _new_platform(self, raw: Raw) -> bool:
        document = PlatformDocument.model_validate(raw)
        if await self._platforms.find_by_key(document.key) is not None:
            return False
        await self._platforms.insert(document)
        return True

    async def _new_type(self, raw: Raw) -> bool:
        document = TypeDocument.model_validate(raw)
        if await self._types.find_by_key(document.kind, document.key) is not None:
            return False
        await self._types.insert(document)
        return True

    async def _new_field(self, raw: Raw) -> bool:
        document = FieldDocument.model_validate(raw)
        if await self._fields.find_by_key(document.scope, document.key, document.industry, document.entity_type):
            return False
        await self._fields.insert(document)
        return True

    async def _restore_files(
        self, archive: zipfile.ZipFile, manifest: Raw, needed: set[str], user: UserContext, summary: ImportSummary
    ) -> dict[str, StoredFile]:
        wanted = manifest.get("files")
        if not isinstance(wanted, dict):
            return {}
        names = set(archive.namelist())
        names_by_path = _names_by_path(_documents_of(manifest, "events"))
        restored: dict[str, StoredFile] = {}
        for old_path, entry in wanted.items():
            if old_path not in needed:
                continue
            if not isinstance(entry, str) or entry not in names:
                summary.failures.append(f"file {old_path}: not in the archive")
                continue
            file_name = names_by_path.get(old_path) or entry.rsplit("/", maxsplit=1)[-1]
            try:
                restored[old_path] = await self._storage.upload(file_name, archive.read(entry), user)
            except Exception as error:
                summary.failures.append(f"file {old_path}: {error}")
                continue
            summary.files_restored += 1
        return restored

    async def _restore_events(self, events: list[Raw], files: dict[str, StoredFile], summary: ImportSummary) -> None:
        highest = 0
        for raw in events:
            try:
                document = EventDocument.model_validate(raw)
            except Exception as error:
                summary.failures.append(f"event {raw.get('name', '?')}: {error}")
                continue
            try:
                if await self._events.find_by_id(document.id) is not None:
                    summary.events_skipped += 1
                    continue
                if await self._events.exists_any({"_id": document.id}):
                    document.id = new_id()
                _repoint_files(document, files)
                document.event_id = await self._free_event_number(document.event_id)
                highest = max(highest, document.event_id)
                await self._events.insert(document)
                summary.events_created += 1
            except Exception as error:
                summary.failures.append(f"event {document.name or document.id}: {error}")
        if highest:
            await self._counters.set_minimum(EVENT_ID_COUNTER, highest)

    async def _free_event_number(self, wanted: int) -> int:
        if wanted > 0 and not await self._events.exists_any({"event_id": wanted}):
            return wanted
        return await self._counters.next_value(EVENT_ID_COUNTER)


def _dump(documents: Iterable[BaseModel]) -> list[Any]:
    return [to_jsonable_python(document.model_dump(by_alias=True)) for document in documents]


def _artifacts_of(document: EventDocument) -> Iterable[Artifact]:
    yield from document.additional_files
    for entity in document.objects:
        for role in FILE_ROLES:
            yield from getattr(entity, role)


def _collect_files(documents: list[EventDocument]) -> dict[str, str]:
    """Bucket path -> `files/<sha1 of the path, 16 hex>[.<suffix>]`, each path once."""
    collected: dict[str, str] = {}
    for document in documents:
        for artifact in _artifacts_of(document):
            if artifact.path in collected:
                continue
            digest = hashlib.sha1(artifact.path.encode("utf-8")).hexdigest()[:PATH_HASH_LENGTH]
            suffix = file_suffix(artifact.name)
            collected[artifact.path] = f"files/{digest}{f'.{suffix}' if suffix else ''}"
    return collected


def _repoint_files(document: EventDocument, files: dict[str, StoredFile]) -> None:
    for artifact in _artifacts_of(document):
        stored = files.get(artifact.path)
        if stored is None:
            continue
        artifact.id = new_id()
        artifact.path = stored.path
        artifact.size_bytes = stored.size_bytes
        artifact.checksum = stored.checksum
        artifact.content_type = stored.content_type or artifact.content_type


def _event_id(event: Raw) -> Any:
    return event.get("_id", event.get("id"))


def _raw_artifacts_of(event: Raw) -> Iterable[Raw]:
    for record in event.get("additional_files") or []:
        if isinstance(record, dict):
            yield record
    for entity in event.get("objects") or []:
        if isinstance(entity, dict):
            for role in FILE_ROLES:
                yield from (record for record in entity.get(role) or [] if isinstance(record, dict))


def _names_by_path(events: list[Raw]) -> dict[str, str]:
    names: dict[str, str] = {}
    for event in events:
        for record in _raw_artifacts_of(event):
            path, name = record.get("path"), record.get("name")
            if isinstance(path, str) and isinstance(name, str):
                names.setdefault(path, name)
    return names


def _read_manifest(archive: zipfile.ZipFile) -> Raw:
    if MANIFEST_ENTRY not in archive.namelist():
        raise ValueError("The archive carries no manifest, so it is not a bundle")
    try:
        manifest = json.loads(archive.read(MANIFEST_ENTRY))
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ValueError("The manifest of the archive could not be read") from error
    if not isinstance(manifest, dict) or manifest.get("format") != BUNDLE_FORMAT:
        raise ValueError("The archive is not a bundle this inventory can read")
    return manifest


def _documents_of(manifest: Raw, key: str) -> list[Raw]:
    values = manifest.get(key)
    return [value for value in values if isinstance(value, dict)] if isinstance(values, list) else []
