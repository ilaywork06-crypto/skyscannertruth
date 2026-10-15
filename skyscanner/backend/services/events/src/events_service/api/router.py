"""All routes of the events service under `/api` (nginx forwards the full path)."""

from fastapi import APIRouter

from events_service.api import events, grid, health, schema, transfer, views
from events_service.constants import API_PREFIX


def build_api_router() -> APIRouter:
    router = APIRouter(prefix=API_PREFIX)
    for module in (health, events, schema, grid, views, transfer):
        router.include_router(module.ROUTER)
    return router
