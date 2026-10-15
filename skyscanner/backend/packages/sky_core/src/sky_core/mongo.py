"""One Motor client per process. Datetimes come back tz-aware (UTC) and UUIDs use the standard representation.

Credentials are redacted from every log line and error (`mongodb://user:***@host`).
"""

import re
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorCollection, AsyncIOMotorDatabase
from pymongo.errors import PyMongoError

from sky_core.errors import SkyscannerError
from sky_core.log import get_logger
from sky_core.settings import MongoSettings

LOGGER = get_logger(__name__)
_URI_CREDENTIALS = re.compile(r"(?P<scheme>mongodb(?:\+srv)?://)(?P<user>[^:@/]+):[^@/]*@")

Document = dict[str, Any]
Collection = AsyncIOMotorCollection[Document]


def redact_uri(uri: str) -> str:
    return _URI_CREDENTIALS.sub(r"\g<scheme>\g<user>:***@", uri)


class MongoProvider:
    """Owns the client; repositories ask it for collections."""

    def __init__(self, settings: MongoSettings) -> None:
        self._settings = settings
        self._client: AsyncIOMotorClient[Document] | None = None

    async def connect(self) -> None:
        if self._client is not None:
            return
        client: AsyncIOMotorClient[Document] = AsyncIOMotorClient(
            self._settings.uri,
            maxPoolSize=self._settings.max_pool_size,
            serverSelectionTimeoutMS=self._settings.server_selection_timeout_ms,
            uuidRepresentation="standard",
            tz_aware=True,
        )
        try:
            await client.admin.command("ping")
        except PyMongoError as error:
            client.close()
            raise SkyscannerError(
                "The document store did not answer the connection check",
                {"uri": redact_uri(self._settings.uri), "reason": str(error)},
            ) from error
        self._client = client
        LOGGER.info(
            "Connected to the document store database %s at %s",
            self._settings.database,
            redact_uri(self._settings.uri),
        )

    def close(self) -> None:
        if self._client is None:
            return
        self._client.close()
        self._client = None
        LOGGER.info("Closed the connection to the document store")

    async def ping(self) -> bool:
        if self._client is None:
            return False
        try:
            await self._client.admin.command("ping")
        except PyMongoError:
            return False
        return True

    @property
    def database(self) -> AsyncIOMotorDatabase[Document]:
        if self._client is None:
            raise SkyscannerError("The document store provider was used before it was connected")
        return self._client[self._settings.database]

    def collection(self, name: str) -> Collection:
        return self.database[name]
