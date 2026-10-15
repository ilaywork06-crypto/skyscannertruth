"""FastAPI plumbing shared by the services: the app factory, the error envelope and the identity dependencies.

Domain errors answer `{"detail": <message>, "error": <class name>, "details": {...}}` with the status of
`ERROR_STATUS_CODES` (exact class lookup; any other `SkyscannerError` is a 500). FastAPI's own request validation
keeps its standard 422 list shape, so clients see both forms, as before.
"""

from collections.abc import Callable
from typing import Annotated, Any

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sky_core.errors import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    SkyscannerError,
    StorageError,
    ValidationError,
)
from sky_core.identity import build_user_context
from sky_core.log import get_logger
from sky_core.models.common import UserContext
from sky_core.models.enums import Permission
from sky_core.settings import get_auth_settings, get_cors_settings

LOGGER = get_logger(__name__)

ERROR_STATUS_CODES: dict[type[SkyscannerError], int] = {
    NotFoundError: 404,
    ConflictError: 409,
    ValidationError: 422,
    PermissionDeniedError: 403,
    StorageError: 502,
}
INTERNAL_ERROR_STATUS = 500


def build_error_body(error: SkyscannerError) -> dict[str, Any]:
    return {"detail": error.message, "error": type(error).__name__, "details": error.details}


async def _handle_domain_error(request: Request, error: Exception) -> JSONResponse:
    assert isinstance(error, SkyscannerError)
    LOGGER.warning("%s while handling %s: %s", type(error).__name__, request.url.path, error.message)
    status = ERROR_STATUS_CODES.get(type(error), INTERNAL_ERROR_STATUS)
    return JSONResponse(status_code=status, content=build_error_body(error))


def create_application(title: str, version: str, description: str, api_prefix: str = "", **extra: Any) -> FastAPI:
    """A FastAPI app with the docs under the prefix, CORS from `CORS_ALLOW_ORIGINS` and the error envelope."""
    app = FastAPI(
        title=title,
        version=version,
        description=description,
        docs_url=f"{api_prefix}/docs",
        redoc_url=f"{api_prefix}/redoc",
        openapi_url=f"{api_prefix}/openapi.json",
        swagger_ui_parameters={"persistAuthorization": True, "displayRequestDuration": True},
        **extra,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_settings().allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )
    app.add_exception_handler(SkyscannerError, _handle_domain_error)
    return app


def get_user_context(request: Request) -> UserContext:
    return build_user_context(request.headers, get_auth_settings())


CurrentUser = Annotated[UserContext, Depends(get_user_context)]


def require_permission(permission: Permission) -> Callable[[UserContext], UserContext]:
    """A dependency that answers 403 unless the caller holds `permission`."""

    def guard(user: CurrentUser) -> UserContext:
        if permission not in user.permissions:
            raise PermissionDeniedError(
                "The identity is not allowed to perform this action", {"permission": permission.value}
            )
        return user

    return guard
