"""sky_core: identity, permissions, text rules, content disposition, URI redaction, error envelope."""

from typing import Any

import httpx

from sky_core.identity import build_user_context, permissions_for_roles
from sky_core.models.enums import Permission, Role
from sky_core.mongo import redact_uri
from sky_core.object_storage import build_object_key, content_disposition
from sky_core.settings import AuthSettings
from sky_core.text import ascii_metadata_value, file_suffix, humanize_key, safe_path_segment, slugify, split_list

AUTH = AuthSettings()


def test_anonymous_caller_is_admin_by_default() -> None:
    user = build_user_context({}, AUTH)
    assert user.username == "anonymous"
    assert user.roles == [Role.ADMIN]
    assert Permission.FIELD_MANAGE in user.permissions


def test_named_user_without_roles_has_no_permissions() -> None:
    user = build_user_context({"x-auth-user": " bob "}, AUTH)
    assert user.username == "bob"
    assert user.roles == []
    assert user.permissions == []


def test_roles_are_parsed_case_insensitively_and_unknown_ones_dropped() -> None:
    headers = {"X-AUTH-USER": "bob", "X-Auth-Roles": "Viewer, wizard, viewer, EDITOR", "X-Auth-Industries": "a, ,b"}
    user = build_user_context(headers, AUTH)
    assert user.roles == [Role.VIEWER, Role.EDITOR]
    assert user.industries == ["a", "b"]


def test_roles_header_without_user_header_is_honoured() -> None:
    assert build_user_context({"X-Auth-Roles": "viewer"}, AUTH).roles == [Role.VIEWER]


def test_anonymous_access_can_be_disabled() -> None:
    settings = AuthSettings(AUTH_ALLOW_ANONYMOUS=False)
    user = build_user_context({}, settings)
    assert user.username == "anonymous"
    assert user.permissions == []


def test_role_permissions_are_cumulative_and_ordered() -> None:
    assert permissions_for_roles([Role.VIEWER]) == [
        Permission.EVENT_READ,
        Permission.FILE_DOWNLOAD,
        Permission.SUBSCRIPTION_MANAGE,
    ]
    editor = permissions_for_roles([Role.EDITOR])
    assert editor[3:] == [
        Permission.EVENT_CREATE,
        Permission.EVENT_UPDATE,
        Permission.ENTITY_MANAGE,
        Permission.FILE_UPLOAD,
        Permission.TEMPLATE_MANAGE,
    ]
    assert permissions_for_roles([Role.ADMIN])[-3:] == [
        Permission.EVENT_DELETE,
        Permission.FIELD_MANAGE,
        Permission.INDUSTRY_MANAGE,
    ]


def test_text_rules() -> None:
    assert slugify("Hello World!") == "hello_world"
    assert slugify("שלום") == ""
    assert humanize_key("experiment_result") == "Experiment Result"
    assert humanize_key("aBc-def") == "ABc Def"
    assert file_suffix("a.TAR.GZ") == "gz"
    assert file_suffix(".bashrc") == "bashrc"
    assert file_suffix("name.") == ""
    assert split_list(" a, ,b ") == ["a", "b"]
    assert safe_path_segment("..") == "unnamed"
    assert safe_path_segment(" a/b\\c\td  e. ") == "a_b_c_d e"
    assert safe_path_segment("קובץ.txt") == "קובץ.txt"
    long_name = "א" * 200 + ".CSV"
    truncated = safe_path_segment(long_name)
    assert truncated.endswith(".csv")
    assert len(truncated.encode()) <= 180
    assert ascii_metadata_value("plain") == "plain"
    assert ascii_metadata_value("ש a/b") == "%D7%A9%20a%2Fb"


def test_content_disposition_carries_both_names() -> None:
    assert content_disposition("attachment", "קובץ.csv") == (
        "attachment; filename=\"____.csv\"; filename*=UTF-8''%D7%A7%D7%95%D7%91%D7%A5.csv"
    )
    assert content_disposition("inline", "") == "inline; filename=\"download\"; filename*=UTF-8''"


def test_object_keys_and_redaction() -> None:
    key = build_object_key("events", "unassigned", "a/b.txt")
    assert key.startswith("events/unassigned/") and key.endswith("/a_b.txt")
    assert redact_uri("mongodb://u:secret@h:27017/?x") == "mongodb://u:***@h:27017/?x"
    assert redact_uri("mongodb://u@h") == "mongodb://u@h"


async def test_error_envelope_and_permission_guard(api: httpx.AsyncClient) -> None:
    missing = await api.get("/api/events/nope")
    assert missing.status_code == 404
    assert missing.json() == {"detail": "The event does not exist", "error": "NotFoundError", "details": {"id": "nope"}}
    viewer: dict[str, Any] = {"X-Auth-User": "val", "X-Auth-Roles": "viewer"}
    refused = await api.post("/api/fields", json={"key": "x", "name": "X"}, headers=viewer)
    assert refused.status_code == 403
    assert refused.json() == {
        "detail": "The identity is not allowed to perform this action",
        "error": "PermissionDeniedError",
        "details": {"permission": "field:manage"},
    }
    malformed = await api.post("/api/events", json={"industry": 3}, headers=viewer | {"X-Auth-Roles": "editor"})
    assert malformed.status_code == 422
    assert isinstance(malformed.json()["detail"], list)


async def test_list_page_bounds_are_validated(api: httpx.AsyncClient) -> None:
    assert (await api.get("/api/events", params={"page": 0})).status_code == 422
    assert (await api.get("/api/events", params={"page_size": 501})).status_code == 422
    assert (await api.get("/api/fields", params={"limit": 501})).status_code == 422


async def test_health(api: httpx.AsyncClient) -> None:
    body = (await api.get("/api/health")).json()
    assert body["service"] == "events-service"
    assert body["status"] == "healthy"
    assert body["database"] == "up"
    assert (await api.get("/api/docs")).status_code == 200
