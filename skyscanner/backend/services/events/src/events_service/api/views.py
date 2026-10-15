"""Per-user records: saved views (templates) and mail subscriptions. Listing needs an identity only."""

from fastapi import APIRouter, status
from sky_core.models.common import OperationResult
from sky_core.models.enums import FieldScope
from sky_core.models.subscription import SubscriptionCreateRequest, SubscriptionResponse
from sky_core.models.template import TemplateCreateRequest, TemplateResponse, TemplateUpdateRequest

from events_service.api.deps import CurrentUser, Limit, Offset, SubscriptionManager, TemplateManager
from events_service.wiring import Services

ROUTER = APIRouter()


@ROUTER.get("/templates", response_model=list[TemplateResponse], tags=["templates"])
async def list_templates(
    services: Services,
    user: CurrentUser,
    scope: FieldScope = FieldScope.EVENT,
    industry: str | None = None,
    offset: Offset = 0,
    limit: Limit = 0,
) -> list[TemplateResponse]:
    return await services.templates.list_templates(user, scope, industry, offset, limit)


@ROUTER.post("/templates", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED, tags=["templates"])
async def create_template(
    request: TemplateCreateRequest, services: Services, user: TemplateManager
) -> TemplateResponse:
    return await services.templates.create_template(request, user)


@ROUTER.patch("/templates/{template_id}", response_model=TemplateResponse, tags=["templates"])
async def update_template(
    template_id: str, request: TemplateUpdateRequest, services: Services, user: TemplateManager
) -> TemplateResponse:
    return await services.templates.update_template(template_id, request, user)


@ROUTER.delete("/templates/{template_id}", response_model=OperationResult, tags=["templates"])
async def delete_template(template_id: str, services: Services, user: TemplateManager) -> OperationResult:
    await services.templates.delete_template(template_id, user)
    return OperationResult(message="The template was removed", affected=1)


@ROUTER.get("/subscriptions", response_model=list[SubscriptionResponse], tags=["subscriptions"])
async def list_subscriptions(
    services: Services, user: CurrentUser, offset: Offset = 0, limit: Limit = 0
) -> list[SubscriptionResponse]:
    return await services.subscriptions.list_subscriptions(user, offset, limit)


@ROUTER.post(
    "/subscriptions", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED, tags=["subscriptions"]
)
async def create_subscription(
    request: SubscriptionCreateRequest, services: Services, user: SubscriptionManager
) -> SubscriptionResponse:
    return await services.subscriptions.create_subscription(request, user)


@ROUTER.delete("/subscriptions/{subscription_id}", response_model=OperationResult, tags=["subscriptions"])
async def delete_subscription(subscription_id: str, services: Services, user: SubscriptionManager) -> OperationResult:
    await services.subscriptions.delete_subscription(subscription_id, user)
    return OperationResult(message="The subscription was removed", affected=1)
