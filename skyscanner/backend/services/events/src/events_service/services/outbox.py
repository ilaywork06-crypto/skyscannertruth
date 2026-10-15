"""Notification rows for the notification service. The events service never sends mail itself: it writes one
outbox row per change and the notification service matches rows against the subscriptions."""

from events_service.documents import EventDocument, OutboxDocument
from events_service.repositories.records import OutboxRepository
from sky_core.models.subscription import SubscriptionTrigger


class Publisher:
    def __init__(self, outbox: OutboxRepository) -> None:
        self._outbox = outbox

    async def publish(self, event: EventDocument, trigger: SubscriptionTrigger, summary: str) -> None:
        await self._outbox.insert(
            OutboxDocument(
                trigger=trigger,
                event_id=event.id,
                event_number=event.event_id,
                event_name=event.name,
                industry=event.industry,
                event_type_keys=list(event.event_type_keys),
                summary=summary,
            )
        )
