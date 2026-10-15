"""Grid configurations (columns generated from built-ins, declared fields and discovered keys) and grid rows.

Events grid with no industry picked: shared fields plus every registered industry's fields (first declaration of a
key wins); discovery adds hidden columns for undeclared keys found in the stored events.
"""

from collections.abc import Awaitable, Callable
from math import ceil
from typing import Any, Protocol, TypeVar

from pydantic_core import to_jsonable_python
from sky_core.models.enums import FieldScope
from sky_core.models.field import FieldResponse
from sky_core.models.grid import FilterOption, GridConfiguration, GridRowsRequest, GridRowsResponse
from sky_core.models.industry import DEFAULT_INDUSTRY_ICON
from sky_grid.configuration import build_grid_configuration
from sky_grid.introspection import SchemaIntrospector
from sky_grid.query import resolve_path

from events_service.constants import (
    ENTITY_BASE_COLUMNS,
    ENTITY_TYPE_VOCABULARY,
    EVENT_BASE_COLUMNS,
    EVENT_TYPE_VOCABULARY,
    FIXED_EVENT_KEYS,
    INDUSTRY_VOCABULARY,
    MODULE_VOCABULARY,
    PLATFORM_VOCABULARY,
)
from events_service.documents import EventDocument
from events_service.repositories.declarations import IndustryRepository, PlatformRepository, TypeRepository
from events_service.repositories.events import EventRepository
from events_service.services.fields import FieldService

SORT_KEY = "created_at"
DISTINCT_LIMIT = 50


class _Declaration(Protocol):
    @property
    def id(self) -> str: ...


DeclarationT = TypeVar("DeclarationT", bound=_Declaration)


class GridService:
    def __init__(
        self,
        events: EventRepository,
        fields: FieldService,
        introspector: SchemaIntrospector,
        types: TypeRepository,
        platforms: PlatformRepository,
        industries: IndustryRepository,
    ) -> None:
        self._events = events
        self._fields = fields
        self._introspector = introspector
        self._types = types
        self._platforms = platforms
        self._industries = industries

    async def event_configuration(
        self, industry: str | None = None, discover: bool = True, industries: list[str] | None = None
    ) -> GridConfiguration:
        picked = list(dict.fromkeys(key for key in [industry, *(industries or [])] if key))
        single = picked[0] if len(picked) == 1 else None
        declared = await self._declared_event_fields(picked)
        if discover:
            declared += await self._introspector.infer_missing_fields(
                {field.key for field in declared},
                FieldScope.EVENT,
                industry=single,
                scope_filter={"industry": {"$in": picked}} if picked else None,
            )
        return build_grid_configuration(
            FieldScope.EVENT, EVENT_BASE_COLUMNS, declared, single, SORT_KEY, await self._event_vocabularies(picked)
        )

    async def entity_configuration(
        self, industry: str | None = None, entity_type: str | None = None
    ) -> GridConfiguration:
        declared = await self._fields.list_fields(FieldScope.ENTITY, industry, entity_type)
        entity_types = await self._types.list_entity_types(industry)
        vocabularies = {
            ENTITY_TYPE_VOCABULARY: [
                FilterOption(value=document.name, label=document.name, label_he=document.name_he)
                for document in entity_types
            ],
            MODULE_VOCABULARY: [
                FilterOption(value=module, label=module) for module in await self._modules_of(industry)
            ],
        }
        return build_grid_configuration(
            FieldScope.ENTITY, ENTITY_BASE_COLUMNS, declared, industry, SORT_KEY, vocabularies
        )

    async def event_rows(self, request: GridRowsRequest) -> GridRowsResponse:
        documents, total = await self._events.search(request)
        return GridRowsResponse(
            rows=[event_row(document) for document in documents],
            total=total,
            page=request.page,
            page_size=request.page_size,
            pages=ceil(total / request.page_size),
        )

    async def distinct_values(self, key: str) -> list[str]:
        return await self._introspector.distinct_values(resolve_path(key, FIXED_EVENT_KEYS), DISTINCT_LIMIT)

    async def _declared_event_fields(self, picked: list[str]) -> list[FieldResponse]:
        keys = picked or [document.key for document in await self._industries.list_all()]
        collected = {field.key: field for field in await self._fields.list_fields(FieldScope.EVENT)}
        for key in keys:
            for field in await self._fields.list_fields(FieldScope.EVENT, industry=key):
                collected.setdefault(field.key, field)
        return list(collected.values())

    async def _event_vocabularies(self, picked: list[str]) -> dict[str, list[FilterOption]]:
        platforms = await _collect(picked, self._platforms.list_all)
        event_types = await _collect(picked, self._types.list_event_types)
        return {
            PLATFORM_VOCABULARY: [
                FilterOption(value=document.key, label=document.name, label_he=document.name_he)
                for document in platforms
            ],
            EVENT_TYPE_VOCABULARY: [
                FilterOption(value=document.name, label=document.name, label_he=document.name_he)
                for document in event_types
            ],
            INDUSTRY_VOCABULARY: [
                FilterOption(
                    value=document.key,
                    label=document.name,
                    label_he=document.name_he,
                    icon=document.icon or DEFAULT_INDUSTRY_ICON,
                )
                for document in await self._industries.list_all()
            ],
        }

    async def _modules_of(self, industry: str | None) -> list[str]:
        modules: dict[str, None] = {}
        for document in await self._industries.list_all():
            if industry is None or document.key == industry:
                modules.update(dict.fromkeys(document.modules))
        return list(modules)


async def _collect(
    industries: list[str], read: Callable[[str | None], Awaitable[list[DeclarationT]]]
) -> list[DeclarationT]:
    """Declarations visible to any of `industries` (all when none), each once."""
    if not industries:
        return await read(None)
    collected: dict[str, DeclarationT] = {}
    for key in industries:
        for document in await read(key):
            collected.setdefault(document.id, document)
    return list(collected.values())


def event_row(document: EventDocument) -> dict[str, Any]:
    """The summary as JSON plus the denormalised type names/keys and the dynamic values."""
    row: dict[str, Any] = to_jsonable_python(document.to_summary().model_dump())
    row["event_type_names"] = list(document.event_type_names)
    row["event_type_keys"] = list(document.event_type_keys)
    row["data"] = to_jsonable_python(document.data)
    return row
