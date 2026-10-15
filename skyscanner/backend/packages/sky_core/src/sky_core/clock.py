"""UTC time helpers. Every stored moment is UTC; a naive datetime is assumed to already be UTC."""

from datetime import UTC, datetime


def utc_now() -> datetime:
    return datetime.now(tz=UTC)


def ensure_utc(value: datetime | None) -> datetime | None:
    """Naive -> tagged as UTC (not converted); aware -> converted to UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
