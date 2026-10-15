"""An entity's parse status follows its parsed files: with parsed files it is `parsed` (or `partially_parsed` when
asked for explicitly), without them it can never claim to be parsed. Parsing products do not count."""

from sky_core.errors import ValidationError
from sky_core.models.common import Artifact
from sky_core.models.enums import EntityStatus

PARSED_LIKE = frozenset({EntityStatus.PARSED, EntityStatus.PARTIALLY_PARSED})


def resolve_status(
    requested: EntityStatus | None,
    current: EntityStatus | None,
    parsed_files: list[Artifact],
    details: dict[str, str],
) -> EntityStatus:
    if parsed_files:
        return EntityStatus.PARTIALLY_PARSED if requested is EntityStatus.PARTIALLY_PARSED else EntityStatus.PARSED
    if requested in PARSED_LIKE:
        raise ValidationError("An entity cannot be marked as parsed while it carries no parsed files", details)
    if requested is not None:
        return requested
    if current is None or current in PARSED_LIKE:
        return EntityStatus.RAW
    return current
