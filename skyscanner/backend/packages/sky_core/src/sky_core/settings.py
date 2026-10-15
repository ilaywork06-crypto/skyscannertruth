"""Environment driven settings, one class per concern.

The environment variable names and defaults are the deployment contract (compose files, scripts, existing `.env`
files), so they are kept exactly. Each class also reads `.env` from the working directory, matches names
case-insensitively and ignores unknown variables. Getters are cached: one object per process.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from sky_core.text import split_list

ENV_FILE = ".env"
_CONFIG = SettingsConfigDict(env_file=ENV_FILE, extra="ignore", case_sensitive=False)


class ServiceSettings(BaseSettings):
    """Where the services find each other."""

    model_config = _CONFIG
    environment: str = Field(default="local", validation_alias="ENVIRONMENT")
    log_level: str = Field(default="INFO", validation_alias="LOG_LEVEL")
    events_service_url: str = Field(default="http://localhost:8000", validation_alias="EVENTS_SERVICE_URL")
    storage_service_url: str = Field(default="http://localhost:8001", validation_alias="STORAGE_SERVICE_URL")
    notification_service_url: str = Field(default="http://localhost:8002", validation_alias="NOTIFICATION_SERVICE_URL")


class MongoSettings(BaseSettings):
    """The document store."""

    model_config = _CONFIG
    uri: str = Field(default="mongodb://localhost:27017", validation_alias="MONGO_URI")
    database: str = Field(default="skyscanner", validation_alias="MONGO_DATABASE")
    max_pool_size: int = Field(default=50, ge=1, validation_alias="MONGO_MAX_POOL_SIZE")
    server_selection_timeout_ms: int = Field(default=5000, ge=100, validation_alias="MONGO_SERVER_SELECTION_TIMEOUT_MS")


class StorageSettings(BaseSettings):
    """The S3 compatible bucket that holds every file.

    `S3_PUBLIC_ENDPOINT_URL` is new: temporary links are signed against it so a browser can follow them (the internal
    endpoint is usually not reachable from outside). `S3_VERIFY_TLS` is new too; the original never verified TLS.
    """

    model_config = _CONFIG
    endpoint_url: str | None = Field(default=None, validation_alias="S3_ENDPOINT_URL")
    public_endpoint_url: str | None = Field(default=None, validation_alias="S3_PUBLIC_ENDPOINT_URL")
    verify_tls: bool = Field(default=True, validation_alias="S3_VERIFY_TLS")
    region: str = Field(default="us-east-1", validation_alias="S3_REGION")
    bucket: str = Field(default="skyscanner-artifacts", validation_alias="S3_BUCKET")
    access_key_id: str | None = Field(default=None, validation_alias="S3_ACCESS_KEY_ID")
    secret_access_key: str | None = Field(default=None, validation_alias="S3_SECRET_ACCESS_KEY")
    presigned_url_ttl_seconds: int = Field(default=3600, ge=60, validation_alias="S3_PRESIGNED_URL_TTL_SECONDS")
    multipart_threshold_bytes: int = Field(
        default=16 * 1024 * 1024, ge=1024, validation_alias="S3_MULTIPART_THRESHOLD_BYTES"
    )
    multipart_chunk_bytes: int = Field(
        default=8 * 1024 * 1024, ge=5 * 1024 * 1024, validation_alias="S3_MULTIPART_CHUNK_BYTES"
    )
    multipart_concurrency: int = Field(default=4, ge=1, le=32, validation_alias="S3_MULTIPART_CONCURRENCY")
    upload_concurrency: int = Field(default=6, ge=1, le=32, validation_alias="S3_UPLOAD_CONCURRENCY")


class AuthSettings(BaseSettings):
    """Identity headers set by the authenticating proxy in front of the services.

    WARNING: with the defaults a request without a user header is served as `anonymous` with the `admin` role. This is
    kept for compatibility with existing deployments; set `AUTH_ALLOW_ANONYMOUS=false` behind a real proxy.
    """

    model_config = _CONFIG
    user_header: str = Field(default="X-Auth-User", validation_alias="AUTH_USER_HEADER")
    email_header: str = Field(default="X-Auth-Email", validation_alias="AUTH_EMAIL_HEADER")
    roles_header: str = Field(default="X-Auth-Roles", validation_alias="AUTH_ROLES_HEADER")
    industries_header: str = Field(default="X-Auth-Industries", validation_alias="AUTH_INDUSTRIES_HEADER")
    allow_anonymous: bool = Field(default=True, validation_alias="AUTH_ALLOW_ANONYMOUS")
    anonymous_roles_raw: str = Field(default="admin", validation_alias="AUTH_ANONYMOUS_ROLES")


class CorsSettings(BaseSettings):
    """Origins allowed to call the services from a browser."""

    model_config = _CONFIG
    allow_origins_raw: str = Field(default="*", validation_alias="CORS_ALLOW_ORIGINS")

    @property
    def allow_origins(self) -> list[str]:
        return split_list(self.allow_origins_raw)


class MailSettings(BaseSettings):
    """SMTP relay and polling cadence of the notification service."""

    model_config = _CONFIG
    host: str = Field(default="localhost", validation_alias="SMTP_HOST")
    port: int = Field(default=1025, ge=1, validation_alias="SMTP_PORT")
    username: str | None = Field(default=None, validation_alias="SMTP_USERNAME")
    password: str | None = Field(default=None, validation_alias="SMTP_PASSWORD")
    use_tls: bool = Field(default=False, validation_alias="SMTP_USE_TLS")
    sender: str = Field(default="skyscanner@example.com", validation_alias="MAIL_FROM")
    poll_interval_seconds: int = Field(default=30, ge=5, validation_alias="NOTIFICATION_POLL_INTERVAL_SECONDS")


@lru_cache(maxsize=1)
def get_service_settings() -> ServiceSettings:
    return ServiceSettings()


@lru_cache(maxsize=1)
def get_mongo_settings() -> MongoSettings:
    return MongoSettings()


@lru_cache(maxsize=1)
def get_storage_settings() -> StorageSettings:
    return StorageSettings()


@lru_cache(maxsize=1)
def get_auth_settings() -> AuthSettings:
    return AuthSettings()


@lru_cache(maxsize=1)
def get_cors_settings() -> CorsSettings:
    return CorsSettings()


@lru_cache(maxsize=1)
def get_mail_settings() -> MailSettings:
    return MailSettings()
