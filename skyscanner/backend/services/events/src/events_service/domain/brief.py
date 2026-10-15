"""The event brief (`name`): typed by people for manual uploads, generated for automated ones.

Full form: `Experiment · falcon · aviation · 27 Aug 2026 · via watchdog · #7`. When it does not fit, platforms and
industry are dropped and the type names are shortened with `…`.
"""

from datetime import datetime

from sky_core.models.enums import UploadSource

PART_SEPARATOR = " · "
PLATFORM_SEPARATOR = " + "
TYPE_SEPARATOR = " / "
DATE_FORMAT = "%d %b %Y"
MAX_NAMED_PLATFORMS = 3
UNTYPED_LABEL = "Event"


def build_event_brief(
    type_names: list[str],
    platforms: list[str],
    industry: str,
    moment: datetime,
    event_number: int,
    upload_source: UploadSource = UploadSource.MANUAL,
) -> str:
    parts = [_type_label(type_names)]
    if platform_label := _platform_label(platforms):
        parts.append(platform_label)
    if industry:
        parts.append(industry)
    return PART_SEPARATOR.join([*parts, _tail(moment, event_number, upload_source)])


def fit_event_brief(
    type_names: list[str],
    platforms: list[str],
    industry: str,
    moment: datetime,
    event_number: int,
    max_length: int,
    upload_source: UploadSource = UploadSource.MANUAL,
) -> str:
    whole = build_event_brief(type_names, platforms, industry, moment, event_number, upload_source)
    if len(whole) <= max_length:
        return whole
    tail = _tail(moment, event_number, upload_source)
    head = _type_label(type_names)
    room = max_length - len(tail) - len(PART_SEPARATOR)
    if room <= 0:
        return tail[-max_length:]
    if len(head) > room:
        head = f"{head[: max(room - 1, 0)].rstrip()}…"
    return f"{head}{PART_SEPARATOR}{tail}"


def _type_label(type_names: list[str]) -> str:
    return TYPE_SEPARATOR.join(type_names) if type_names else UNTYPED_LABEL


def _tail(moment: datetime, event_number: int, upload_source: UploadSource) -> str:
    parts = [moment.strftime(DATE_FORMAT)]
    if upload_source is not UploadSource.MANUAL:
        parts.append(f"via {upload_source.value}")
    parts.append(f"#{event_number}")
    return PART_SEPARATOR.join(parts)


def _platform_label(platforms: list[str]) -> str:
    named = [platform for platform in platforms if platform]
    if len(named) <= MAX_NAMED_PLATFORMS:
        return PLATFORM_SEPARATOR.join(named)
    shown = PLATFORM_SEPARATOR.join(named[:MAX_NAMED_PLATFORMS])
    return f"{shown} +{len(named) - MAX_NAMED_PLATFORMS}"
