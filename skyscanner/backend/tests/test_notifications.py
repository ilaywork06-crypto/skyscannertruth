"""Notification service end to end: events-service outbox rows -> matching subscriptions -> mails (aiosmtpd)."""

from typing import Any

import httpx

from tests.conftest import MailBox, unique


async def test_dispatch_end_to_end(
    api: httpx.AsyncClient,
    notifications: httpx.AsyncClient,
    mailbox: tuple[MailBox, int],
    raw_db: Any,
    industry: str,
    event_type: dict[str, Any],
) -> None:
    box, _ = mailbox
    await notifications.post("/api/notifications/dispatch")
    box.messages.clear()
    follower, refused = f"{unique('f')}@example.com", f"{unique('r')}@example.com"
    for email in (follower, refused):
        response = await api.post(
            "/api/subscriptions", json={"email": email, "industry": industry, "triggers": ["event_created"]}
        )
        assert response.status_code == 201
    await api.post(
        "/api/subscriptions", json={"email": "updates@example.com", "industry": industry, "triggers": ["event_updated"]}
    )
    box.refused.add(refused)
    event = (
        await api.post(
            "/api/events", json={"industry": industry, "event_type_keys": [event_type["key"]], "name": "Mail me"}
        )
    ).json()

    viewer = {"X-Auth-User": "nobody", "X-Auth-Roles": ""}
    assert (await notifications.post("/api/notifications/dispatch", headers=viewer)).status_code == 403
    first = (await notifications.post("/api/notifications/dispatch")).json()
    assert first == {"success": True, "message": "The pending notifications were dispatched", "affected": 1}
    assert [message["To"] for message in box.messages] == [follower]
    message = box.messages[0]
    assert message["Subject"] == "[Skyscanner] A new event was uploaded - Mail me"
    body = message.get_payload()
    assert f"Event: Mail me (#{event['event_id']})" in body and f"Open the event at /events/{event['id']}" in body
    row = await raw_db.notification_outbox.find_one({"event_id": event["id"]})
    assert row["attempts"] == 1 and row["processed_at"] is None and len(row["delivered_to"]) == 1

    box.refused.clear()
    await notifications.post("/api/notifications/dispatch")
    assert sorted(message["To"] for message in box.messages) == sorted([follower, refused])
    row = await raw_db.notification_outbox.find_one({"event_id": event["id"]})
    assert row["processed_at"] is not None
    subscription = await raw_db.subscriptions.find_one({"email": follower})
    assert subscription["last_notified_at"] is not None


async def test_malformed_rows_do_not_block_the_queue(notifications: httpx.AsyncClient, raw_db: Any) -> None:
    identifier = unique("bad")
    await raw_db.notification_outbox.insert_one({"_id": identifier, "trigger": "nonsense", "processed_at": None})
    await notifications.post("/api/notifications/dispatch")
    row = await raw_db.notification_outbox.find_one({"_id": identifier})
    assert row["processed_at"] is not None and row["failure"] == "The notification could not be read"
    health = (await notifications.get("/api/notifications/health")).json()
    assert health["service"] == "notification-service" and health["pending"] == "0"
