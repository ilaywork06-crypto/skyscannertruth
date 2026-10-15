# One image recipe for the three Python services; the compose file names which one to build.
#   PACKAGE - the uv workspace member (events-service, storage-service, notification-service)
#   MODULE  - its import name (events_service, storage_service, notification_service)
#   PORT    - the port it listens on (8000, 8001, 8002)
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ARG PACKAGE
ARG MODULE
ARG PORT=8000

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH" \
    SERVICE_MODULE=${MODULE} \
    SERVICE_PORT=${PORT}

WORKDIR /app

# The workspace has to be whole before it can be installed against its lockfile.
COPY pyproject.toml uv.lock ./
COPY skyscanner/backend ./skyscanner/backend

RUN uv sync --frozen --package "${PACKAGE}" --no-dev

EXPOSE ${PORT}

CMD ["sh", "-c", "exec uvicorn \"${SERVICE_MODULE}.main:create_app\" --factory --host 0.0.0.0 --port \"${SERVICE_PORT}\""]
