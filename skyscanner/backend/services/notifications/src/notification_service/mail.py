"""The mail sent for one notification to one subscriber (plain text, one SMTP connection per mail)."""

from email.message import EmailMessage

import aiosmtplib
from sky_core.settings import MailSettings

from notification_service.store import Notification

TRIGGER_LABELS = {
    "event_created": "A new event was uploaded",
    "event_updated": "An event was updated",
    "entity_added": "An entity was added",
    "entity_parsed": "An entity was parsed",
}


def compose(notification: Notification, recipient: str, sender: str) -> EmailMessage:
    label = TRIGGER_LABELS.get(notification.trigger.value, notification.trigger.value)
    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = f"[Skyscanner] {label} - {notification.event_name}"
    message.set_content(
        f"{label}.\n\n"
        f"Event: {notification.event_name} (#{notification.event_number})\n"
        f"Industry: {notification.industry}\n"
        f"Types: {', '.join(notification.event_type_keys) or 'none'}\n\n"
        f"{notification.summary}\n\n"
        f"Open the event at /events/{notification.event_id}\n"
    )
    return message


class Mailer:
    def __init__(self, settings: MailSettings) -> None:
        self._settings = settings

    async def send(self, notification: Notification, recipient: str) -> None:
        """`start_tls=None` lets aiosmtplib upgrade when the server offers STARTTLS; `SMTP_USE_TLS` forces it."""
        settings = self._settings
        await aiosmtplib.send(
            compose(notification, recipient, settings.sender),
            hostname=settings.host,
            port=settings.port,
            username=settings.username or None,
            password=settings.password or None,
            start_tls=settings.use_tls or None,
        )
