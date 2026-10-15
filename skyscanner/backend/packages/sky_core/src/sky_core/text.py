"""Text helpers whose exact rules are part of the stored data (keys, bucket paths, archive entries, labels).

Changing any rule here changes keys that are already stored, so each one mirrors the original behaviour exactly.
"""

import re
import unicodedata
from urllib.parse import quote

_NON_KEY_CHARACTERS = re.compile(r"[^a-z0-9]+")
_KEY_SEPARATORS = re.compile(r"[_.\-\s]+")
_PATH_SEPARATORS = re.compile(r"[\\/]+")
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f]+")
_WHITESPACE = re.compile(r"\s+")
_NON_ASCII_METADATA = re.compile(r"[^\x20-\x7e]")
_TRIMMED_EDGES = ". "
MAX_SEGMENT_BYTES = 180
FALLBACK_SEGMENT = "unnamed"


def slugify(value: str) -> str:
    """Lowercase ASCII key: every run of other characters becomes `_` (non-ASCII letters are dropped)."""
    return _NON_KEY_CHARACTERS.sub("_", value.strip().lower()).strip("_")


def humanize_key(value: str) -> str:
    """`experiment_result` -> `Experiment Result`: split on `_ . -` and spaces, capitalise each first letter."""
    parts = [part for part in _KEY_SEPARATORS.split(value) if part]
    return " ".join(part[0].upper() + part[1:] for part in parts)


def file_suffix(file_name: str) -> str:
    """The lowercased text after the last dot, or `""` when the name has no dot."""
    if "." not in file_name:
        return ""
    return file_name.rsplit(".", maxsplit=1)[1].lower()


def split_list(value: str, separator: str = ",") -> list[str]:
    """Split, strip and drop the empty parts."""
    return [part.strip() for part in value.split(separator) if part.strip()]


def safe_path_segment(value: str, fallback: str = FALLBACK_SEGMENT, max_bytes: int = MAX_SEGMENT_BYTES) -> str:
    """One path segment that is safe for a bucket key or a zip entry, keeping letters of every alphabet."""
    cleaned = unicodedata.normalize("NFC", value)
    cleaned = _PATH_SEPARATORS.sub("_", cleaned)
    cleaned = _CONTROL_CHARACTERS.sub("_", cleaned)
    cleaned = _WHITESPACE.sub(" ", cleaned).strip(_TRIMMED_EDGES)
    return _truncate_segment(cleaned, max_bytes) or fallback


def _truncate_segment(value: str, max_bytes: int) -> str:
    if len(value.encode("utf-8")) <= max_bytes:
        return value
    suffix = file_suffix(value)
    tail = f".{suffix}" if suffix else ""
    stem = value[: -len(tail)] if tail else value
    room = max_bytes - len(tail.encode("utf-8"))
    cut = stem.encode("utf-8")[: max(room, 0)].decode("utf-8", errors="ignore")
    return cut.strip(_TRIMMED_EDGES) + tail


def ascii_metadata_value(value: str) -> str:
    """S3 metadata must be ASCII: a value with any other character is percent-encoded as a whole."""
    if not _NON_ASCII_METADATA.search(value):
        return value
    return quote(value, safe="")
