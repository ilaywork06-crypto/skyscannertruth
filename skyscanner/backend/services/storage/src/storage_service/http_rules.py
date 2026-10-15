"""Pure HTTP rules of the content endpoint: byte ranges and the media type used for in-browser previews."""

from dataclasses import dataclass

from sky_core.text import file_suffix

INLINE_TEXT_CONTENT_TYPE = "text/plain; charset=utf-8"
TEXT_CONTENT_TYPE_SUFFIXES = ("+json", "+xml", "+yaml")
TEXT_CONTENT_TYPES = frozenset(
    {
        "application/csv",
        "application/javascript",
        "application/json",
        "application/ld+json",
        "application/ndjson",
        "application/sql",
        "application/toml",
        "application/x-ndjson",
        "application/x-sh",
        "application/x-yaml",
        "application/xml",
        "application/yaml",
    }
)
TEXT_FILE_SUFFIXES = frozenset(
    {
        "cfg", "conf", "csv", "ini", "js", "json", "jsonl", "log", "md", "ndjson", "properties",
        "py", "sh", "sql", "toml", "ts", "tsv", "txt", "xml", "yaml", "yml",
    }
)  # fmt: skip


class UnsatisfiableRange(Exception):  # noqa: N818 - reads as a condition, like StopIteration
    """A well formed range that starts past the end of the file (answered with 416)."""


@dataclass(frozen=True)
class ByteWindow:
    start: int
    end: int

    @property
    def length(self) -> int:
        return self.end - self.start + 1


def read_range(header: str | None, size: int) -> ByteWindow | None:
    """A single `bytes=` range, clamped to the file; None means "send everything" (absent, malformed, several
    ranges, or an empty file). `bytes=-N` is the last N bytes. Raises `UnsatisfiableRange` when the range starts at
    or after the end of the file."""
    if header is None or size <= 0:
        return None
    unit, _, spans = header.partition("=")
    if unit.strip().lower() != "bytes" or "," in spans:
        return None
    first, separator, last = spans.strip().partition("-")
    if not separator:
        return None
    try:
        if not first:
            length = int(last)
            start, end = (max(size - length, 0) if length > 0 else 0), size - 1
        else:
            start, end = int(first), int(last) if last else size - 1
    except ValueError:
        return None
    if start < 0:
        return None
    if start >= size:
        raise UnsatisfiableRange
    end = min(end, size - 1)
    return ByteWindow(start, end) if start <= end else None


def preview_media_type(content_type: str, file_name: str) -> str:
    """Images and PDFs keep their type; anything text-shaped is shown as plain UTF-8 text (never executed)."""
    bare = content_type.split(";", maxsplit=1)[0].strip().lower()
    if bare.startswith("image/") or bare == "application/pdf":
        return content_type
    text_shaped = (
        bare.startswith("text/")
        or bare in TEXT_CONTENT_TYPES
        or bare.endswith(TEXT_CONTENT_TYPE_SUFFIXES)
        or file_suffix(file_name) in TEXT_FILE_SUFFIXES
    )
    return INLINE_TEXT_CONTENT_TYPE if text_shaped else content_type


def archive_entry(entry: str, taken: set[str]) -> str:
    """A safe, unique path inside a zip: no empty, `.` or `..` segments; repeats become `name (2).ext`..."""
    segments = [segment for segment in entry.replace("\\", "/").split("/") if segment not in {"", ".", ".."}]
    cleaned = "/".join(segments) or "unnamed"
    stem, dot, suffix = cleaned.rpartition(".")
    if not dot or "/" in suffix:
        stem, dot, suffix = cleaned, "", ""
    candidate, copy = cleaned, 2
    while candidate in taken:
        candidate = f"{stem} ({copy}){dot}{suffix}"
        copy += 1
    taken.add(candidate)
    return candidate
