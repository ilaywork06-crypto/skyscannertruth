"""Test infrastructure: a real MongoDB (fresh, uniquely named databases dropped afterwards), a moto S3 server and an
aiosmtpd mail server. The three apps run in-process (ASGI) with their real lifespans.

MongoDB defaults to `mongodb://localhost:27017` (override with `TEST_MONGO_URI`).
"""

import os
import socket
import uuid
from collections.abc import AsyncIterator, Iterator
from email import message_from_bytes
from email.message import Message
from typing import Any

import httpx
import pytest
from aiosmtpd.controller import Controller
from asgi_lifespan import LifespanManager
from moto.server import ThreadedMotoServer
from motor.motor_asyncio import AsyncIOMotorClient

from events_service.main import create_app as create_events_app
from events_service.services.storage_client import StorageClient
from notification_service.main import create_app as create_notification_app
from sky_core.settings import AuthSettings, MailSettings, MongoSettings, ServiceSettings, StorageSettings
from storage_service.main import create_app as create_storage_app

MONGO_URI = os.environ.get("TEST_MONGO_URI", "mongodb://localhost:27017")
ADMIN = {"X-Auth-User": "alice", "X-Auth-Roles": "admin", "X-Auth-Email": "alice@example.com"}


def free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def unique(prefix: str = "k") -> str:
    return f"{prefix}{uuid.uuid4().hex[:10]}"


class MailBox:
    """aiosmtpd handler keeping every received message."""

    def __init__(self) -> None:
        self.messages: list[Message] = []
        self.refused: set[str] = set()

    async def handle_RCPT(self, server: Any, session: Any, envelope: Any, address: str, options: Any) -> str:  # noqa: N802
        if address in self.refused:
            return "550 refused for the test"
        envelope.rcpt_tos.append(address)
        return "250 OK"

    async def handle_DATA(self, server: Any, session: Any, envelope: Any) -> str:  # noqa: N802
        self.messages.append(message_from_bytes(envelope.content))
        return "250 Message accepted"


@pytest.fixture(scope="session")
def database_name() -> Iterator[str]:
    name = f"skytest_{uuid.uuid4().hex[:12]}"
    yield name
    client: Any = __import__("pymongo").MongoClient(MONGO_URI)
    client.drop_database(name)
    client.close()


@pytest.fixture(scope="session")
def mongo_settings(database_name: str) -> MongoSettings:
    return MongoSettings(MONGO_URI=MONGO_URI, MONGO_DATABASE=database_name)


@pytest.fixture
async def raw_db(mongo_settings: MongoSettings) -> AsyncIterator[Any]:
    client: AsyncIOMotorClient[dict[str, Any]] = AsyncIOMotorClient(mongo_settings.uri, tz_aware=True)
    yield client[mongo_settings.database]
    client.close()


@pytest.fixture(scope="session")
def s3_endpoint() -> Iterator[str]:
    port = free_port()
    server = ThreadedMotoServer(ip_address="127.0.0.1", port=port)
    server.start()
    yield f"http://127.0.0.1:{port}"
    server.stop()


@pytest.fixture(scope="session")
def storage_settings(s3_endpoint: str) -> StorageSettings:
    return StorageSettings(
        S3_ENDPOINT_URL=s3_endpoint,
        S3_ACCESS_KEY_ID="test",
        S3_SECRET_ACCESS_KEY="test",
        S3_BUCKET=unique("bucket-"),
        S3_MULTIPART_THRESHOLD_BYTES=1024 * 1024,
        S3_MULTIPART_CHUNK_BYTES=5 * 1024 * 1024,
        S3_MULTIPART_CONCURRENCY=2,
    )


@pytest.fixture(scope="session")
def mailbox() -> Iterator[tuple[MailBox, int]]:
    box = MailBox()
    port = free_port()
    controller = Controller(box, hostname="127.0.0.1", port=port)
    controller.start()
    yield box, port
    controller.stop()


@pytest.fixture(scope="session")
async def storage_client(storage_settings: StorageSettings) -> AsyncIterator[httpx.AsyncClient]:
    app = create_storage_app(storage_settings)
    async with LifespanManager(app), _client(app, "http://storage") as client:
        yield client


def _client(app: Any, base_url: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url=base_url, headers=ADMIN, timeout=60)


def bundle_storage(storage_client: httpx.AsyncClient) -> StorageClient:
    """The events service's storage client, wired to the in-process storage app."""
    transport = storage_client._transport  # noqa: SLF001 - reuse the in-process transport
    settings = ServiceSettings(STORAGE_SERVICE_URL="http://storage")
    return StorageClient(settings, AuthSettings(), transport=transport)


@pytest.fixture(scope="session")
async def api(mongo_settings: MongoSettings, storage_client: httpx.AsyncClient) -> AsyncIterator[httpx.AsyncClient]:
    """The events service, as an administrator."""
    app = create_events_app(mongo_settings, bundle_storage(storage_client))
    async with LifespanManager(app), _client(app, "http://events") as client:
        yield client


@pytest.fixture(scope="session")
async def notifications(
    mongo_settings: MongoSettings, mailbox: tuple[MailBox, int]
) -> AsyncIterator[httpx.AsyncClient]:
    mail = MailSettings(SMTP_HOST="127.0.0.1", SMTP_PORT=mailbox[1], NOTIFICATION_POLL_INTERVAL_SECONDS=3600)
    app = create_notification_app(mongo_settings, mail)
    async with LifespanManager(app), _client(app, "http://notifications") as client:
        yield client


@pytest.fixture
async def industry(api: httpx.AsyncClient) -> str:
    """A fresh industry, so a test's events can be told apart from the others in the shared database."""
    key = unique("ind")
    response = await api.post("/api/industries", json={"key": key, "name": key.upper()})
    assert response.status_code == 201
    return key


@pytest.fixture
async def event_type(api: httpx.AsyncClient) -> dict[str, Any]:
    key = unique("type")
    response = await api.post("/api/types/events", json={"key": key, "name": f"Type {key}"})
    assert response.status_code == 201
    return dict(response.json())


@pytest.fixture
async def entity_type(api: httpx.AsyncClient) -> dict[str, Any]:
    key = unique("ent")
    response = await api.post("/api/types/entities", json={"key": key, "name": f"Entity {key}"})
    assert response.status_code == 201
    return dict(response.json())


def artifact(name: str, path: str | None = None, folder: str | None = None) -> dict[str, Any]:
    return {"id": unique(), "name": name, "path": path or f"events/test/{unique()}_{name}", "folder": folder}
