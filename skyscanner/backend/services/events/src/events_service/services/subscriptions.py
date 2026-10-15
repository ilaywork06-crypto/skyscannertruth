"""Mail subscriptions. A subscription follows an industry, an event type or a single event; the notification
service matches outbox rows against them. Nothing checks that the followed target exists."""

from events_service.documents import SubscriptionDocument
from events_service.repositories.records import SubscriptionRepository
from sky_core.errors import ConflictError, NotFoundError, PermissionDeniedError, ValidationError
from sky_core.models.common import UserContext
from sky_core.models.subscription import SubscriptionCreateRequest, SubscriptionResponse, SubscriptionTrigger


class SubscriptionService:
    def __init__(self, repository: SubscriptionRepository) -> None:
        self._repository = repository

    async def list_subscriptions(
        self, user: UserContext, offset: int = 0, limit: int = 0
    ) -> list[SubscriptionResponse]:
        documents = await self._repository.list_for_owner(user.username, offset, limit)
        return [document.to_response() for document in documents]

    async def create_subscription(self, request: SubscriptionCreateRequest, user: UserContext) -> SubscriptionResponse:
        if not any((request.industry, request.event_id, request.event_type_key)):
            raise ValidationError("A subscription has to follow an industry, an event type or an event")
        if request.event_id is not None and SubscriptionTrigger.EVENT_CREATED in request.triggers:
            raise ValidationError(
                "A subscription to a single event cannot be notified about the upload of an event",
                {"event_id": request.event_id},
            )
        target = {
            "owner": user.username,
            "email": request.email,
            "industry": request.industry,
            "event_type_key": request.event_type_key,
            "event_id": request.event_id,
        }
        if await self._repository.find_one(target) is not None:
            raise ConflictError("This target is already followed by this mail address", {"email": request.email})
        document = SubscriptionDocument(**request.model_dump(), owner=user.username)
        await self._repository.insert(document)
        return document.to_response()

    async def delete_subscription(self, subscription_id: str, user: UserContext) -> None:
        document = await self._repository.find_by_id(subscription_id)
        if document is None:
            raise NotFoundError("The subscription does not exist", {"id": subscription_id})
        if document.owner != user.username:
            raise PermissionDeniedError("Only the owner of a subscription may remove it")
        await self._repository.delete(subscription_id, user.username)
