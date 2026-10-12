"""
The convention behind an event brief that nobody wrote, built out of what the event already says about itself.

:date: 2026-08-27
:author: t_beatrice
"""
# ----- IMPORTS ----- #

from datetime import datetime

from skyscanner_models.enums import UploadSource

# ----- CONSTS ----- #

# The brief is read at a glance in a table of a hundred rows, so it is written as a few short facts rather
# than as a sentence: what happened, where it ran, which industry it belongs to, when, and which event it is.
PART_SEPARATOR: str = " · "
PLATFORM_SEPARATOR: str = " + "
TYPE_SEPARATOR: str = " / "

# The day is spelled out rather than written in digits, because a brief is read next to briefs somebody typed
# and "27 Aug 2026" cannot be mistaken for a reference number the way 27/08/2026 can.
DATE_FORMAT: str = "%d %b %Y"

# The running number of the event, which is what makes a generated brief unique even when two events of the
# same type ran on the same platform on the same day.
NUMBER_PREFIX: str = "#"

# Past this the platforms are counted rather than named, so that an event that ran on eleven rigs does not
# turn into a brief nobody can read.
MAX_NAMED_PLATFORMS: int = 3

# What an event without a single declared type is called, which only a caller that sent none can produce.
UNTYPED_LABEL: str = "Event"

# How the event reached the system, named only when it was not a person filling the wizard in - which is the
# ordinary case and therefore the one worth saying nothing about.
SOURCE_PREFIX: str = "via "

# ----- FUNCTIONS ----- #


def build_event_brief(
    type_names: list[str],
    platforms: list[str],
    industry: str,
    moment: datetime,
    event_number: int,
    upload_source: UploadSource = UploadSource.MANUAL,
) -> str:
    """
    Write the brief of an event whose uploader did not write one.

    The brief is what an event is listed, searched and recognised by, and asking for it was the one thing
    standing between a watchdog - or a user in a hurry - and an uploaded event. It is therefore derived
    instead, out of the four things every event already carries: what kind of activity it was, where it ran,
    which industry it belongs to and when it happened. The running number closes it, so two events that agree
    on all four are still told apart, and a brief that reads oddly is corrected on the event page like any
    other value - nothing about it is fixed once it has been written.

    :param type_names: Names of the event types the event was filed under.
    :param platforms: Keys of the platforms the event ran on.
    :param industry: Key of the industry the event belongs to.
    :param moment: Moment the brief is dated by, which is the date of the activity or of the upload.
    :param event_number: Running number the system minted for the event.
    :param upload_source: How the event reached the system.
    :return: The generated brief.
    """
    parts: list[str] = [TYPE_SEPARATOR.join(type_names) if type_names else UNTYPED_LABEL]

    platform_label = _platform_label(platforms=platforms)
    if platform_label:
        parts.append(platform_label)

    if industry:
        parts.append(industry)

    parts.append(moment.strftime(DATE_FORMAT))

    if upload_source is not UploadSource.MANUAL:
        parts.append(f"{SOURCE_PREFIX}{upload_source.value}")

    parts.append(f"{NUMBER_PREFIX}{event_number}")

    return PART_SEPARATOR.join(parts)


def fit_event_brief(
    type_names: list[str],
    platforms: list[str],
    industry: str,
    moment: datetime,
    event_number: int,
    max_length: int,
    upload_source: UploadSource = UploadSource.MANUAL,
) -> str:
    """
    Write the brief of an automated upload within the length every brief is held to.

    The whole convention is tried first. Past the limit the platforms and the industry are left out - the
    industry has a column of its own and so do the platforms - and past that the name of the type is cut,
    so the date and the running number that tell two such events apart always survive.

    :param type_names: Names of the event types the event was filed under.
    :param platforms: Keys of the platforms the event ran on.
    :param industry: Key of the industry the event belongs to.
    :param moment: Moment the brief is dated by, which is the date of the activity or of the upload.
    :param event_number: Running number the system minted for the event.
    :param max_length: Largest length the brief may take.
    :param upload_source: How the event reached the system.
    :return: The generated brief, at most `max_length` characters long.
    """
    whole = build_event_brief(
        type_names=type_names,
        platforms=platforms,
        industry=industry,
        moment=moment,
        event_number=event_number,
        upload_source=upload_source,
    )
    if len(whole) <= max_length:
        return whole

    tail_parts = [moment.strftime(DATE_FORMAT)]
    if upload_source is not UploadSource.MANUAL:
        tail_parts.append(f"{SOURCE_PREFIX}{upload_source.value}")
    tail_parts.append(f"{NUMBER_PREFIX}{event_number}")
    tail = PART_SEPARATOR.join(tail_parts)

    head = TYPE_SEPARATOR.join(type_names) if type_names else UNTYPED_LABEL
    room = max_length - len(tail) - len(PART_SEPARATOR)
    if room <= 0:
        return tail[-max_length:]

    if len(head) > room:
        head = f"{head[: max(room - 1, 0)].rstrip()}…"

    return f"{head}{PART_SEPARATOR}{tail}"


def _platform_label(platforms: list[str]) -> str:
    """
    Name the platforms an event ran on, counting them once there are more of them than a brief can carry.

    :param platforms: Keys of the platforms the event ran on.
    :return: The platforms as one readable piece of the brief, empty when the event named none.
    """
    named = [platform for platform in platforms if platform]
    if not named:
        return ""

    if len(named) <= MAX_NAMED_PLATFORMS:
        return PLATFORM_SEPARATOR.join(named)

    return f"{PLATFORM_SEPARATOR.join(named[:MAX_NAMED_PLATFORMS])} +{len(named) - MAX_NAMED_PLATFORMS}"
