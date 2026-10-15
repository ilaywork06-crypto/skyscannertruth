"""Domain errors. Each class maps to one HTTP status (see `sky_core.api`); the class name travels in the error
envelope as `error`, so the names are part of the API."""


class SkyscannerError(Exception):
    """Base error: a message for people plus string details for programs."""

    def __init__(self, message: str, details: dict[str, str] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details: dict[str, str] = details or {}


class NotFoundError(SkyscannerError):
    """404: the addressed document does not exist (or was soft deleted)."""


class ConflictError(SkyscannerError):
    """409: the request collides with an existing key or name."""


class ValidationError(SkyscannerError):
    """422: the request breaks a business rule (FastAPI's own 422 covers malformed input)."""


class PermissionDeniedError(SkyscannerError):
    """403: the identity lacks the permission."""


class StorageError(SkyscannerError):
    """502: the object storage failed."""
