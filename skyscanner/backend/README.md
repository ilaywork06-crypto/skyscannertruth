# Skyscanner backend

Three FastAPI services and two shared packages, in one uv workspace (root `pyproject.toml`). The HTTP API, the
MongoDB collections and document shapes, the bucket key layout and the environment variables are compatible with the
previous implementation; the deliberate behaviour changes are listed at the end.

## Layout

```
packages/
  sky_core/        settings, logging, Mongo provider, identity + permissions, errors + error envelope, app factory,
                   ids, text and time helpers, S3 client, the pydantic API models (sky_core.models.*)
  sky_grid/        grid column generation + version, query translation (filters/sort/search -> Mongo),
                   discovery of undeclared dynamic keys
services/
  events/          events_service        :8000  /api
    api/           thin routers (one use case per handler)
    services/      use cases (events, entities, fields, types, platforms, industries, templates, subscriptions,
                   revisions, renames, grid, exports, bundles, storage client, outbox publisher)
    repositories/  the only code touching MongoDB (+ migrations, rename rewrites)
    domain/        pure rules: brief, dynamic values (build_values), status, artifacts, change tracking, renames
    documents.py   stored document shapes      constants.py  collections, fixed keys, built-in grid columns
    bootstrap.py   migrations + indexes        wiring.py     dependency wiring (one Container per request)
  storage/         storage_service       :8001  /api/storage   (S3 only, no database)
  notifications/   notification_service  :8002  /api/notifications
tests/             pytest suite (real MongoDB, moto S3 server, aiosmtpd)
```

Services listen on their prefixed paths; nginx forwards the full path.

## Running by hand

```bash
uv sync                                    # from the repository root
docker run -d --name sky-mongo -p 27017:27017 mongo:7

uv run uvicorn events_service.main:create_app --factory --port 8000
S3_ENDPOINT_URL=http://localhost:9000 S3_ACCESS_KEY_ID=skyscanner S3_SECRET_ACCESS_KEY=skyscanner-secret \
  uv run uvicorn storage_service.main:create_app --factory --port 8001
SMTP_HOST=localhost SMTP_PORT=1025 uv run uvicorn notification_service.main:create_app --factory --port 8002
```

Docs: `/api/docs`, `/api/storage/docs`, `/api/notifications/docs`. Identity comes from the `X-Auth-User`,
`X-Auth-Roles` (`viewer`/`editor`/`admin`), `X-Auth-Email` and `X-Auth-Industries` headers.

> **Anonymous access:** by default (`AUTH_ALLOW_ANONYMOUS=true`, `AUTH_ANONYMOUS_ROLES=admin`) a request without
> `X-Auth-User` is served as `anonymous` **with the admin role**. This is kept for compatibility. Behind a real
> authenticating proxy set `AUTH_ALLOW_ANONYMOUS=false`.

Environment variables (same names and defaults as before): `MONGO_URI`, `MONGO_DATABASE`, `MONGO_MAX_POOL_SIZE`,
`MONGO_SERVER_SELECTION_TIMEOUT_MS`, `LOG_LEVEL`, `ENVIRONMENT`, `STORAGE_SERVICE_URL`, `CORS_ALLOW_ORIGINS`,
`AUTH_*`, `S3_*`, `SMTP_*`, `MAIL_FROM`, `NOTIFICATION_POLL_INTERVAL_SECONDS`. New:

| Variable | Default | Meaning |
|---|---|---|
| `S3_PUBLIC_ENDPOINT_URL` | unset | Bucket URL a browser can reach; temporary links are signed against it. Unset: links point at `/api/storage/artifacts/content` instead |
| `S3_VERIFY_TLS` | `true` | Verify the bucket's TLS certificate |

`STORAGE_SERVICE_URL` is the storage service's base URL (e.g. `http://storage-service:8001`); the events service adds
`/api/storage` itself (a value that already ends with `/api/storage` keeps working).

## Tests, lint, types

```bash
uv run pytest                              # needs MongoDB; TEST_MONGO_URI (default mongodb://localhost:27017)
uv run ruff check skyscanner/backend
uv run ruff format --check skyscanner/backend
uv run mypy                                # strict, configured in the root pyproject.toml
```

Each test session uses a fresh, uniquely named database (`skytest_*`) and drops it at the end. S3 is a moto server
and mail an aiosmtpd server, both started in-process; the three apps run in-process with their real lifespans.

## Deliberate behaviour changes

1. **Renames rewrite saved views.** Renaming a field rewrites `filters[].key`, `sort[].key` and `columns[].key` of the
   templates (`key`, `data.key`, and `objects.key` / `objects.data.key` for entity fields in event views); renaming
   an event type, entity type or platform replaces the old key in the filter values on those columns. The dry-run
   tally (`GET .../rename`) now counts the views that would change (the old cascade matched nothing).
2. **Collisions with soft-deleted documents answer 409**, not a raw 500: any write hitting a unique index
   (re-creating a key/name a removed declaration still holds) returns a `ConflictError` envelope. Renaming a template
   onto a taken name is checked first (409).
3. **Bundle import reaches the storage service:** the client posts to `STORAGE_SERVICE_URL` + `/api/storage/artifacts`.
4. **Temporary links** are presigned against `S3_PUBLIC_ENDPOINT_URL` when set, else they stream through the
   storage service (`/api/storage/artifacts/content?path=...&name=...`).
5. **`POST /api/notifications/dispatch` requires `subscription:manage`**; dispatch rounds never overlap.
6. **Mail retries do not duplicate:** each outbox row records `delivered_to` (subscription ids already mailed) and a
   retry only mails the rest. **A malformed outbox row** is marked processed with `failure` instead of blocking the
   queue. Rows given up after 5 rounds also carry `failure`.
7. **Range:** a range starting at or past the end of the file answers `416` with `Content-Range: bytes */<size>`
   (other malformed or multi-ranges still answer 200 with the whole file).
8. **`S3_VERIFY_TLS`** (default true) replaces the hard-coded `verify=False`.
9. **Exports:** CSV of lists of numbers (or booleans) works; CSV/JSON exports are streamed and no longer capped at
   10,000 events. (The bundle and file-archive manifests keep the 10,000 event cap: they are one JSON document.)
10. **Filtering/sorting by `id`, `event_type_keys`, `entity_counts`** (and dotted paths below fixed keys such as
    `entity_counts.<type>`) addresses the stored fields instead of `data.*`; `objects.object_type_key` works as an
    entity condition.
11. **`GET /api/events` with `page < 1` or `page_size` outside 1..500** answers FastAPI's 422 instead of a 500.

Unchanged on purpose (compatibility): anonymous defaults, header-trust identity, the error envelope and status map,
soft-delete everywhere, migrations at every start, the 15 s totals cache, the brief rules, the partial-update
semantics of each endpoint (types/platforms write nulls; others drop them), entity status recomputation on every
PATCH, and the entity-type rename overwriting an existing count under the new key.
