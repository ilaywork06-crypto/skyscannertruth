"""Attachment rules: a file record list may not hold the same name twice in the same virtual folder (the bucket key
does not matter, people tell files apart by name)."""

from sky_core.errors import ValidationError
from sky_core.models.common import Artifact


def require_unique_artifacts(artifacts: list[Artifact], label: str) -> None:
    seen: set[tuple[str, str]] = set()
    repeated: set[str] = set()
    for artifact in artifacts:
        key = (artifact.folder or "", artifact.name)
        if key in seen:
            repeated.add(artifact.name)
        seen.add(key)
    if repeated:
        raise ValidationError(
            "The same file cannot be attached twice under the same name",
            {"files": ", ".join(sorted(repeated)), "attached_to": label},
        )


def require_unique_entity_files(
    name: str, raw_files: list[Artifact], parsed_files: list[Artifact], parsed_additional_files: list[Artifact]
) -> None:
    """Each role is checked on its own: the same name may be both raw and parsed."""
    require_unique_artifacts(raw_files, f"the raw files of {name}")
    require_unique_artifacts(parsed_files, f"the parsed files of {name}")
    require_unique_artifacts(parsed_additional_files, f"the parsing products of {name}")
