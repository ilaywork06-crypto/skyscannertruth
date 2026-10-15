"""The outbox and subscription collections, as the notification service reads and marks them.

Outbox row states: pending (`processed_at` null) or done (`processed_at` set: sent, given up, or unreadable).
Two fields are written in addition to the events service's shape, both optional for readers:
- `delivered_to`: subscription ids already mailed, so a retry never mails them twice;
- `failure`: why a row was given up (an unreadable row, or too many failed rounds).
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic import ValidationError as PydanticValidationError
from sky_core.clock import utc_now
from sky_core.log import get_logger
from sky_core.models.subscription import SubscriptionTrigger
from sky_core.mongo import MongoProvider

LOGGER = get_logger(__name__)
OUTBOX_COLLECTION = "notification_outbox"
SUBSCRIPTIONS_COLLECTION = "subscriptions"
PENDING = {"processed_at": None}


class Notification(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    trigger: SubscriptionTrigger
    event_id: str
    event_number: int = 0
    event_name: str = ""
    industry: str = ""
    event_type_keys: list[str] = []
    summary: str = ""
    attempts: int = Field(default=0, ge=0)
    created_at: datetime
    processed_at: datetime | None = None
    delivered_to: list[str] = []


class Subscription(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(alias="_id")
    email: str


class NotificationStore:
    def __init__(self, provider: MongoProvider) -> None:
        self._provider = provider

    @property
    def _outbox(self) -> Any:
        return self._provider.collection(OUTBOX_COLLECTION)

    async def pending(self, limit: int) -> list[Notification]:
        """The oldest pending rows; an unreadable row is marked failed so it never blocks the queue."""
        readable: list[Notification] = []
        async for raw in self._outbox.find(PENDING).sort([("created_at", 1)]).limit(limit):
            try:
                readable.append(Notification.model_validate(raw))
            except PydanticValidationError as error:
                LOGGER.error("The notification %s cannot be read and is given up: %s", raw.get("_id"), error)
                await self.mark_processed(str(raw.get("_id")), failure="The notification could not be read")
        return readable

    async def count_pending(self) -> int:
        return int(await self._outbox.count_documents(PENDING))

    async def matching(self, notification: Notification) -> list[Subscription]:
        """Active, live subscriptions listing the trigger and following the industry, the event or one of its
        types (any of the three)."""
        targets: list[dict[str, Any]] = [{"industry": notification.industry}, {"event_id": notification.event_id}]
        if notification.event_type_keys:
            targets.append({"event_type_key": {"$in": notification.event_type_keys}})
        query = {
            "active": True,
            "deleted": {"$ne": True},
            "triggers": notification.trigger.value,
            "$or": targets,
        }
        cursor = self._provider.collection(SUBSCRIPTIONS_COLLECTION).find(query)
        return [Subscription.model_validate(raw) async for raw in cursor]

    async def record_delivery(self, notification_id: str, subscription_id: str) -> None:
        await self._outbox.update_one({"_id": notification_id}, {"$addToSet": {"delivered_to": subscription_id}})
        await self._provider.collection(SUBSCRIPTIONS_COLLECTION).update_one(
            {"_id": subscription_id}, {"$set": {"last_notified_at": utc_now()}}
        )

    async def record_failure(self, notification_id: str) -> None:
        await self._outbox.update_one({"_id": notification_id}, {"$inc": {"attempts": 1}})

    async def mark_processed(self, notification_id: str, failure: str | None = None) -> None:
        changes: dict[str, Any] = {"processed_at": utc_now()}
        if failure:
            changes["failure"] = failure
        await self._outbox.update_one({"_id": notification_id}, {"$set": changes})
