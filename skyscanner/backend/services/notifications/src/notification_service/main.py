"""Application factory: `uvicorn notification_service.main:create_app --factory --port 8002`.

The service creates no indexes (the events service owns the outbox and its `pending` index).
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, FastAPI, Request
from sky_core.api import create_application, require_permission
from sky_core.clock import utc_now
from sky_core.log import configure_logging
from sky_core.models.common import OperationResult, UserContext
from sky_core.models.enums import Permission
from sky_core.mongo import MongoProvider
from sky_core.settings import MailSettings, MongoSettings, get_mail_settings, get_mongo_settings, get_service_settings

from notification_service.dispatch import DispatchService
from notification_service.mail import Mailer
from notification_service.store import NotificationStore

SERVICE_NAME = "notification-service"
DESCRIPTION = "Turns the pending notifications of the inventory into mails for the subscribers"
ROUTER = APIRouter(prefix="/api/notifications")
Dispatcher = Annotated[UserContext, Depends(require_permission(Permission.SUBSCRIPTION_MANAGE))]


@ROUTER.get("/health", tags=["health"])
async def read_health(request: Request) -> dict[str, str]:
    """Always 200; `pending` is a string, "0" when the database is down."""
    reachable = await request.app.state.mongo.ping()
    pending = await request.app.state.store.count_pending() if reachable else 0
    return {
        "service": SERVICE_NAME,
        "status": "healthy" if reachable else "degraded",
        "database": "up" if reachable else "down",
        "pending": str(pending),
        "checked_at": utc_now().isoformat(),
    }


@ROUTER.post("/dispatch", response_model=OperationResult, tags=["dispatch"])
async def dispatch_now(request: Request, _: Dispatcher) -> OperationResult:
    sent = await request.app.state.dispatch.dispatch_once()
    return OperationResult(message="The pending notifications were dispatched", affected=sent)


def create_app(mongo: MongoSettings | None = None, mail: MailSettings | None = None) -> FastAPI:
    """The optional arguments let tests use other settings."""
    configure_logging(SERVICE_NAME, get_service_settings().log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        provider = MongoProvider(mongo or get_mongo_settings())
        await provider.connect()
        mail_settings = mail or get_mail_settings()
        store = NotificationStore(provider)
        dispatch = DispatchService(store, Mailer(mail_settings), mail_settings.poll_interval_seconds)
        app.state.mongo, app.state.store, app.state.dispatch = provider, store, dispatch
        dispatch.start()
        try:
            yield
        finally:
            await dispatch.stop()
            provider.close()

    app = create_application(
        "Skyscanner notification service", "0.2.0", DESCRIPTION, api_prefix="/api/notifications", lifespan=lifespan
    )
    app.include_router(ROUTER)
    return app
