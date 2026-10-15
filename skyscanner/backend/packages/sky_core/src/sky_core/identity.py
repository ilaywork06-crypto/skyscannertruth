"""Who is calling: identity is read from headers set by an authenticating proxy (nothing is verified here).

Rules kept from the original, because scripts and deployments rely on them:
- header names are configurable and matched case-insensitively;
- a request without a user header becomes `anonymous`, with the roles header or else `AUTH_ANONYMOUS_ROLES`
  (default `admin`!) when `AUTH_ALLOW_ANONYMOUS` is true (the default);
- a named user without a roles header has no roles; unknown roles are dropped silently.
"""

from collections.abc import Iterable, Mapping

from sky_core.models.common import UserContext
from sky_core.models.enums import Permission, Role
from sky_core.settings import AuthSettings
from sky_core.text import split_list

ANONYMOUS_USER = "anonymous"

VIEWER_PERMISSIONS: tuple[Permission, ...] = (
    Permission.EVENT_READ,
    Permission.FILE_DOWNLOAD,
    Permission.SUBSCRIPTION_MANAGE,
)
EDITOR_PERMISSIONS: tuple[Permission, ...] = (
    *VIEWER_PERMISSIONS,
    Permission.EVENT_CREATE,
    Permission.EVENT_UPDATE,
    Permission.ENTITY_MANAGE,
    Permission.FILE_UPLOAD,
    Permission.TEMPLATE_MANAGE,
)
ADMIN_PERMISSIONS: tuple[Permission, ...] = (
    *EDITOR_PERMISSIONS,
    Permission.EVENT_DELETE,
    Permission.FIELD_MANAGE,
    Permission.INDUSTRY_MANAGE,
)
ROLE_PERMISSIONS: dict[Role, tuple[Permission, ...]] = {
    Role.VIEWER: VIEWER_PERMISSIONS,
    Role.EDITOR: EDITOR_PERMISSIONS,
    Role.ADMIN: ADMIN_PERMISSIONS,
}


def permissions_for_roles(roles: Iterable[Role]) -> list[Permission]:
    """Union of the roles' permissions, in order of first appearance."""
    granted = {permission: None for role in roles for permission in ROLE_PERMISSIONS[role]}
    return list(granted)


def parse_roles(raw: str) -> list[Role]:
    roles: dict[Role, None] = {}
    for candidate in split_list(raw):
        try:
            roles[Role(candidate.lower())] = None
        except ValueError:
            continue
    return list(roles)


def build_user_context(headers: Mapping[str, str], settings: AuthSettings) -> UserContext:
    lowered = {name.lower(): value for name, value in headers.items()}
    username = lowered.get(settings.user_header.lower(), "").strip()
    raw_roles = lowered.get(settings.roles_header.lower(), "").strip()
    if not username and settings.allow_anonymous:
        username = ANONYMOUS_USER
        raw_roles = raw_roles or settings.anonymous_roles_raw
    roles = parse_roles(raw_roles)
    return UserContext(
        username=username or ANONYMOUS_USER,
        email=lowered.get(settings.email_header.lower()) or None,
        roles=roles,
        industries=split_list(lowered.get(settings.industries_header.lower(), "")),
        permissions=permissions_for_roles(roles),
    )
