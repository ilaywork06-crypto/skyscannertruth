"""Shared handler parameters: the caller's identity per permission, and the offset/limit window of list endpoints
(`limit=0` means every match)."""

from typing import Annotated

from fastapi import Depends, Query

from sky_core.api import CurrentUser, require_permission
from sky_core.models.common import UserContext
from sky_core.models.enums import Permission
from sky_core.models.pagination import MAX_PAGE_SIZE

__all__ = ["CurrentUser"]

Reader = Annotated[UserContext, Depends(require_permission(Permission.EVENT_READ))]
EventCreator = Annotated[UserContext, Depends(require_permission(Permission.EVENT_CREATE))]
EventEditor = Annotated[UserContext, Depends(require_permission(Permission.EVENT_UPDATE))]
EventRemover = Annotated[UserContext, Depends(require_permission(Permission.EVENT_DELETE))]
EntityManager = Annotated[UserContext, Depends(require_permission(Permission.ENTITY_MANAGE))]
SchemaManager = Annotated[UserContext, Depends(require_permission(Permission.FIELD_MANAGE))]
IndustryManager = Annotated[UserContext, Depends(require_permission(Permission.INDUSTRY_MANAGE))]
TemplateManager = Annotated[UserContext, Depends(require_permission(Permission.TEMPLATE_MANAGE))]
SubscriptionManager = Annotated[UserContext, Depends(require_permission(Permission.SUBSCRIPTION_MANAGE))]
Downloader = Annotated[UserContext, Depends(require_permission(Permission.FILE_DOWNLOAD))]

Offset = Annotated[int, Query(ge=0, description="Documents skipped before the window")]
Limit = Annotated[int, Query(ge=0, le=MAX_PAGE_SIZE, description="Largest window, zero for every match")]
