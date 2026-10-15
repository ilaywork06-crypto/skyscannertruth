"""Liveness: always 200; `degraded` when the document store does not answer."""

from fastapi import APIRouter, Request

from events_service.constants import SERVICE_NAME
from sky_core.clock import utc_now

ROUTER = APIRouter(tags=["health"])


@ROUTER.get("/health")
async def read_health(request: Request) -> dict[str, str]:
    reachable = await request.app.state.mongo.ping()
    return {
        "service": SERVICE_NAME,
        "status": "healthy" if reachable else "degraded",
        "database": "up" if reachable else "down",
        "checked_at": utc_now().isoformat(),
    }
