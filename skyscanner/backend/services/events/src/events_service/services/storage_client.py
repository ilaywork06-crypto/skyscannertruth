"""HTTP client of the storage service, used by the bundle import to put restored files back into the bucket.

`STORAGE_SERVICE_URL` names the storage service (e.g. `http://storage-service:8001`); the client adds the service's
`/api/storage` prefix itself. A URL that already ends with the prefix (the workaround of older deployments) still
works. The caller's user and roles are forwarded so the storage service applies its own permission check.
"""

from dataclasses import dataclass

import httpx
from sky_core.models.common import UserContext
from sky_core.settings import AuthSettings, ServiceSettings

STORAGE_PREFIX = "/api/storage"
DEFAULT_CONTENT_TYPE = "application/octet-stream"
UPLOAD_TIMEOUT_SECONDS = 600.0


@dataclass(frozen=True)
class StoredFile:
    path: str
    size_bytes: int
    content_type: str
    checksum: str | None


class StorageClient:
    def __init__(
        self, settings: ServiceSettings, auth: AuthSettings, transport: httpx.AsyncBaseTransport | None = None
    ):
        base = settings.storage_service_url.rstrip("/")
        self._base_url = base if base.endswith(STORAGE_PREFIX) else f"{base}{STORAGE_PREFIX}"
        self._auth = auth
        self._transport = transport

    async def upload(self, file_name: str, content: bytes, user: UserContext) -> StoredFile:
        headers = {
            self._auth.user_header: user.username,
            self._auth.roles_header: ",".join(role.value for role in user.roles),
        }
        async with httpx.AsyncClient(timeout=UPLOAD_TIMEOUT_SECONDS, transport=self._transport) as client:
            response = await client.post(
                f"{self._base_url}/artifacts",
                files={"files": (file_name, content, DEFAULT_CONTENT_TYPE)},
                data={"owner_kind": "events"},
                headers=headers,
            )
        if response.status_code >= httpx.codes.BAD_REQUEST:
            raise RuntimeError(f"the storage service refused the file ({response.status_code})")
        artifacts = response.json().get("artifacts") or []
        if not artifacts:
            raise RuntimeError("the storage service wrote nothing")
        written = artifacts[0]
        return StoredFile(
            path=str(written.get("path", "")),
            size_bytes=int(written.get("size_bytes") or 0),
            content_type=str(written.get("content_type") or DEFAULT_CONTENT_TYPE),
            checksum=written.get("checksum"),
        )
