"""Grid configurations and rows. Responses are camelCase (by alias); requests are snake_case."""

from typing import Annotated

from fastapi import APIRouter, Query
from sky_core.models.grid import GridConfiguration, GridRowsRequest, GridRowsResponse

from events_service.api.deps import Reader
from events_service.wiring import Services

ROUTER = APIRouter(prefix="/grid", tags=["grid"])


@ROUTER.get("/events/columns", response_model=GridConfiguration)
async def read_event_columns(
    services: Services,
    _: Reader,
    industry: str | None = None,
    discover: bool = True,
    industries: Annotated[list[str] | None, Query()] = None,
) -> GridConfiguration:
    return await services.grid.event_configuration(industry, discover, industries)


@ROUTER.get("/entities/columns", response_model=GridConfiguration)
async def read_entity_columns(
    services: Services, _: Reader, industry: str | None = None, entity_type: str | None = None
) -> GridConfiguration:
    return await services.grid.entity_configuration(industry, entity_type)


@ROUTER.post("/events/rows", response_model=GridRowsResponse)
async def read_event_rows(request: GridRowsRequest, services: Services, _: Reader) -> GridRowsResponse:
    return await services.grid.event_rows(request)


@ROUTER.get("/events/values/{key}", response_model=list[str])
async def read_column_values(key: str, services: Services, _: Reader) -> list[str]:
    return await services.grid.distinct_values(key)
