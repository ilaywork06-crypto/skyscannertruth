"""Storage service against a moto S3 server: uploads (single PUT and multipart), browser-driven multipart, ranged
content (206 and 416), previews, archives, temporary links, metadata and delete."""

import io
import zipfile
from typing import Any

import httpx
import pytest
from asgi_lifespan import LifespanManager

from sky_core.settings import StorageSettings
from storage_service.http_rules import UnsatisfiableRange, archive_entry, preview_media_type, read_range
from storage_service.main import create_app as create_storage_app
from tests.conftest import ADMIN

MIB = 1024 * 1024


async def upload(client: httpx.AsyncClient, name: str, content: bytes, **form: str) -> dict[str, Any]:
    response = await client.post("/api/storage/artifacts", files={"files": (name, content, "text/plain")}, data=form)
    assert response.status_code == 201, response.text
    return dict(response.json()["artifacts"][0])


def test_range_rules() -> None:
    assert read_range(None, 10) is None
    assert read_range("bytes=2-4", 10) == read_range("bytes=2-4", 10)
    window = read_range("bytes=2-", 10)
    assert window is not None and (window.start, window.end, window.length) == (2, 9, 8)
    suffix = read_range("bytes=-3", 10)
    assert suffix is not None and (suffix.start, suffix.end) == (7, 9)
    assert read_range("bytes=0-1,4-5", 10) is None
    assert read_range("items=0-1", 10) is None
    assert read_range("bytes=5-2", 10) is None
    with pytest.raises(UnsatisfiableRange):
        read_range("bytes=10-", 10)
    assert preview_media_type("application/x-yaml", "a.bin") == "text/plain; charset=utf-8"
    assert preview_media_type("application/octet-stream", "a.log") == "text/plain; charset=utf-8"
    assert preview_media_type("image/png", "a.txt") == "image/png"
    taken: set[str] = set()
    assert [archive_entry(entry, taken) for entry in ["a/../b.txt", "a/b.txt", "/a//b.txt", ".env", ".env", ""]] == [
        "a/b.txt",
        "a/b (2).txt",
        "a/b (3).txt",
        ".env",
        " (2).env",
        "unnamed",
    ]


async def test_small_upload_content_ranges_and_delete(storage_client: httpx.AsyncClient) -> None:
    stored = await upload(storage_client, "notes/ü.txt", b"0123456789", owner_id="abc", kind="raw", descriptor="d")
    assert stored["name"] == "notes_ü.txt" and stored["kind"] == "raw" and stored["suffix"] == "txt"
    assert stored["path"].startswith("events/abc/") and stored["path"].endswith("_notes_ü.txt")
    assert stored["size_bytes"] == 10 and stored["source"] == "upload://events/abc" and stored["uploaded_by"] == "alice"
    path = stored["path"]

    whole = await storage_client.get("/api/storage/artifacts/content", params={"path": path})
    assert whole.status_code == 200 and whole.content == b"0123456789"
    assert whole.headers["accept-ranges"] == "bytes"
    part = await storage_client.get(
        "/api/storage/artifacts/content", params={"path": path}, headers={"Range": "bytes=2-4"}
    )
    assert part.status_code == 206 and part.content == b"234"
    assert part.headers["content-range"] == "bytes 2-4/10"
    beyond = await storage_client.get(
        "/api/storage/artifacts/content", params={"path": path}, headers={"Range": "bytes=20-"}
    )
    assert beyond.status_code == 416 and beyond.headers["content-range"] == "bytes */10"
    preview = await storage_client.get(
        "/api/storage/artifacts/content", params={"path": path, "inline": "true", "name": "שם.txt"}
    )
    assert preview.headers["content-type"] == "text/plain; charset=utf-8"
    assert preview.headers["content-disposition"].startswith('inline; filename="__.txt"')

    metadata = (await storage_client.get("/api/storage/artifacts/metadata", params={"path": path})).json()
    assert metadata["size_bytes"] == 10 and metadata["checksum"]
    link = (await storage_client.get("/api/storage/artifacts/link", params={"path": path, "name": "x.txt"})).json()
    assert link["url"].startswith("/api/storage/artifacts/content?path=") and link["name"] == "x.txt"

    removed = await storage_client.request("DELETE", "/api/storage/artifacts", params={"path": path})
    assert removed.json() == {"success": True, "message": "The file was removed", "affected": 1}
    missing = await storage_client.get("/api/storage/artifacts/content", params={"path": path})
    assert missing.status_code == 404 and missing.json()["detail"] == "The file is not stored"


async def test_large_upload_goes_multipart(storage_client: httpx.AsyncClient) -> None:
    content = bytes(range(256)) * (6 * MIB // 256 + 7)
    stored = await upload(storage_client, "big.bin", content)
    assert stored["size_bytes"] == len(content)
    assert stored["checksum"].endswith("-2")
    tail = await storage_client.get(
        "/api/storage/artifacts/content", params={"path": stored["path"]}, headers={"Range": "bytes=-5"}
    )
    assert tail.content == content[-5:]


async def test_browser_driven_multipart(storage_client: httpx.AsyncClient) -> None:
    begun = await storage_client.post(
        "/api/storage/artifacts/uploads", json={"file_name": "movie.bin", "kind": "parsed"}
    )
    assert begun.status_code == 201
    upload_id, path = begun.json()["upload_id"], begun.json()["path"]
    assert begun.json()["part_size"] == 5 * MIB and begun.json()["max_parts"] == 10000
    base = f"/api/storage/artifacts/uploads/{upload_id}"
    first, second = b"a" * (5 * MIB), b"b" * 100
    out_of_range = await storage_client.put(f"{base}/parts/0", params={"path": path}, content=b"x")
    assert out_of_range.status_code == 422
    one = (await storage_client.put(f"{base}/parts/1", params={"path": path}, content=first)).json()
    two = (await storage_client.put(f"{base}/parts/2", params={"path": path}, content=second)).json()
    assert one["number"] == 1 and one["size_bytes"] == 5 * MIB
    status = (await storage_client.get(base, params={"path": path})).json()
    assert [part["number"] for part in status["parts"]] == [1, 2]
    empty = await storage_client.post(f"{base}/complete", json={"file_name": "movie.bin", "path": path, "parts": []})
    assert empty.status_code == 422
    done = await storage_client.post(
        f"{base}/complete", json={"file_name": "movie.bin", "path": path, "kind": "parsed", "parts": [two, one]}
    )
    assert done.status_code == 200, done.text
    assert done.json()["size_bytes"] == len(first) + len(second) and done.json()["kind"] == "parsed"
    closed = await storage_client.get(base, params={"path": path})
    assert closed.status_code == 404 and closed.json()["detail"] == "The upload is not open"

    other = (await storage_client.post("/api/storage/artifacts/uploads", json={"file_name": "x"})).json()
    aborted = await storage_client.delete(
        f"/api/storage/artifacts/uploads/{other['upload_id']}", params={"path": other["path"]}
    )
    assert aborted.json()["message"] == "The upload was given up"


async def test_archive(storage_client: httpx.AsyncClient) -> None:
    first = await upload(storage_client, "a.txt", b"first")
    second = await upload(storage_client, "b.txt", b"second")
    request = {
        "entries": [
            {"path": first["path"], "entry": "dir/a.txt"},
            {"path": second["path"], "entry": "dir/a.txt"},
            {"path": "events/missing", "entry": "gone.txt"},
        ],
        "documents": [{"entry": "manifest.json", "content": "{}"}],
        "archive_name": "תיק.zip",
    }
    response = await storage_client.post("/api/storage/artifacts/archive", json=request)
    assert response.status_code == 200 and response.headers["content-type"] == "application/zip"
    assert "filename*=UTF-8''%D7%AA%D7%99%D7%A7.zip" in response.headers["content-disposition"]
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert archive.namelist() == ["manifest.json", "dir/a.txt", "dir/a (2).txt"]
        assert archive.read("dir/a (2).txt") == b"second"


async def test_permissions_and_health(storage_client: httpx.AsyncClient) -> None:
    viewer = {"X-Auth-User": "v", "X-Auth-Roles": "viewer"}
    refused = await storage_client.post("/api/storage/artifacts", files={"files": ("a", b"x")}, headers=viewer)
    assert refused.status_code == 403 and refused.json()["details"] == {"permission": "file:upload"}
    health = (await storage_client.get("/api/storage/health")).json()
    assert health["service"] == "storage-service" and health["bucket"] == "up"


async def test_presigned_links_use_the_public_endpoint(storage_settings: StorageSettings) -> None:
    public = storage_settings.model_copy(update={"public_endpoint_url": "http://files.example.com:9000"})
    app = create_storage_app(public)
    transport = httpx.ASGITransport(app=app)
    async with (
        LifespanManager(app),
        httpx.AsyncClient(transport=transport, base_url="http://s", headers=ADMIN) as client,
    ):
        stored = await upload(client, "l.txt", b"link")
        link = (await client.get("/api/storage/artifacts/link", params={"path": stored["path"]})).json()
        assert link["url"].startswith("http://files.example.com:9000/")
        assert "Signature=" in link["url"] and "response-content-disposition" in link["url"]
