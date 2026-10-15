"""Application factory: `uvicorn storage_service.main:create_app --factory --port 8001`.

The bucket is connected (and created when missing) at startup; an unreachable bucket aborts the start.
The optional argument lets tests use other settings.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sky_core.api import create_application
from sky_core.log import configure_logging
from sky_core.object_storage import ObjectStorageClient
from sky_core.settings import StorageSettings, get_service_settings, get_storage_settings

from storage_service.api import ROUTER, SERVICE_NAME

DESCRIPTION = "Uploads, downloads and temporary links for every file the inventory refers to"


def create_app(settings: StorageSettings | None = None) -> FastAPI:
    configure_logging(SERVICE_NAME, get_service_settings().log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        storage = ObjectStorageClient(settings or get_storage_settings())
        await storage.start()
        app.state.storage = storage
        app.state.storage_settings = settings or get_storage_settings()
        try:
            yield
        finally:
            await storage.stop()

    app = create_application(
        "Skyscanner storage service", "0.2.0", DESCRIPTION, api_prefix="/api/storage", lifespan=lifespan
    )
    app.include_router(ROUTER)
    return app
