"""Application factory: `uvicorn events_service.main:create_app --factory --port 8000`.

At startup the document store is connected and prepared (migrations, indexes); a failing store aborts the start.
The optional arguments let tests point the app at another database or storage service.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from events_service.api.router import build_api_router
from events_service.bootstrap import prepare_database
from events_service.constants import API_PREFIX, SERVICE_DESCRIPTION, SERVICE_NAME, SERVICE_TITLE, SERVICE_VERSION
from events_service.services.storage_client import StorageClient
from events_service.wiring import default_storage_client
from sky_core.api import create_application
from sky_core.log import configure_logging
from sky_core.mongo import MongoProvider
from sky_core.settings import MongoSettings, get_mongo_settings, get_service_settings


def create_app(mongo: MongoSettings | None = None, storage_client: StorageClient | None = None) -> FastAPI:
    configure_logging(SERVICE_NAME, get_service_settings().log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        provider = MongoProvider(mongo or get_mongo_settings())
        await provider.connect()
        app.state.mongo = provider
        app.state.storage_client = storage_client or default_storage_client()
        try:
            await prepare_database(provider)
            yield
        finally:
            provider.close()

    app = create_application(SERVICE_TITLE, SERVICE_VERSION, SERVICE_DESCRIPTION, API_PREFIX, lifespan=lifespan)
    app.include_router(build_api_router())
    return app
