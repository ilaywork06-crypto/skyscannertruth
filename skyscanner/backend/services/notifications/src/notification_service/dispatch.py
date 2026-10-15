"""The dispatch loop: every poll interval, the oldest 50 pending notifications are mailed to their subscribers.

A notification is retried for up to 5 rounds while some subscriber could not be reached; subscribers already mailed
are not mailed again. After the last round it is marked processed (given up). A notification nobody follows is
simply marked processed.
"""

import asyncio
import contextlib

import aiosmtplib

from notification_service.mail import Mailer
from notification_service.store import Notification, NotificationStore
from sky_core.log import get_logger

LOGGER = get_logger(__name__)
BATCH_SIZE = 50
MAX_DELIVERY_ATTEMPTS = 5


class DispatchService:
    def __init__(self, store: NotificationStore, mailer: Mailer, poll_interval_seconds: float) -> None:
        self._store = store
        self._mailer = mailer
        self._interval = poll_interval_seconds
        self._task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task is None:
            return
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await self._task
        self._task = None
        LOGGER.info("The dispatch loop was stopped")

    async def _run(self) -> None:
        while True:
            try:
                if sent := await self.dispatch_once():
                    LOGGER.info("Sent %d notification mails", sent)
            except Exception as error:
                LOGGER.exception("The dispatch round failed: %s", error)
            await asyncio.sleep(self._interval)

    async def dispatch_once(self) -> int:
        """One round; returns the number of mails sent. Rounds never overlap (the API can trigger one)."""
        async with self._lock:
            sent = 0
            for notification in await self._store.pending(BATCH_SIZE):
                sent += await self._deliver(notification)
            return sent

    async def _deliver(self, notification: Notification) -> int:
        sent = 0
        failed = False
        delivered = set(notification.delivered_to)
        for subscription in await self._store.matching(notification):
            if subscription.id in delivered:
                continue
            try:
                await self._mailer.send(notification, subscription.email)
            except (aiosmtplib.SMTPException, OSError) as error:
                LOGGER.warning("Could not mail %s: %s", subscription.email, error)
                failed = True
                continue
            await self._store.record_delivery(notification.id, subscription.id)
            sent += 1
        if failed and notification.attempts + 1 < MAX_DELIVERY_ATTEMPTS:
            await self._store.record_failure(notification.id)
            return sent
        if failed:
            LOGGER.error(
                "Giving up on the notification about %s after %d rounds", notification.event_name, MAX_DELIVERY_ATTEMPTS
            )
        await self._store.mark_processed(notification.id, "Some subscribers could not be mailed" if failed else None)
        return sent
