# Skyscanner - the inventory

Every event that produced files, the entities nested inside it, and every raw, parsed and additional file that
belongs to them, filed by industry.

| Part | Where | Notes |
| --- | --- | --- |
| Events service | `backend/services/events` | `:8000`, `/api` - events, entities, taxonomy, grid, saved views, exports, bundles |
| Storage service | `backend/services/storage` | `:8001`, `/api/storage` - uploads (whole and multipart), ranged content, links, archives |
| Notification service | `backend/services/notifications` | `:8002`, `/api/notifications` - subscriptions mailed from the outbox |
| Client | `web` | Vue 3, the Lattice look, AG Grid for the inventory |
| Deployment | `docker` | compose with MongoDB, MinIO and MailHog |

See [backend/README.md](backend/README.md) for the services and their tests.

## Running

```bash
cd docker
cp .env.example .env        # optional - everything has a default
docker compose up --build   # http://localhost:8080, MinIO console :9001, MailHog :8025
```

Setting `MONGO_URI` in `.env` points every service at your own MongoDB and the bundled container is not started.

**Identity.** The services trust the `X-Auth-User`, `X-Auth-Email`, `X-Auth-Roles` and `X-Auth-Industries` headers set
by the authenticating reverse proxy in front of nginx. Out of the box a caller without headers is treated as an
**administrator** (`AUTH_ALLOW_ANONYMOUS=true`, `AUTH_ANONYMOUS_ROLES=admin`), exactly as before. Turn that off in
any deployment that is reachable by more than its operators.

## Client

```bash
npm install                 # from the repository root
npm run dev                 # http://localhost:5173
```

The dev server proxies `/api/storage` to `STORAGE_SERVICE_URL` (default `http://localhost:8001`),
`/api/notifications` to `NOTIFICATION_SERVICE_URL` (`:8002`) and `/api` to `EVENTS_SERVICE_URL` (`:8000`).
Build-time settings: `VITE_API_BASE_URL` (default `/api`), `VITE_MAP_TILE_URL` and `VITE_MAP_ATTRIBUTION` (a tile
server for the coordinate field; without one a point is typed in).

What the client stores in the browser - all under the `skyscanner.` prefix: private saved views
(`skyscanner.templates.private`), the active view, upload resume state (same keys as before, so views and
interrupted uploads survive the upgrade), and the theme, colour theme, language and sidebar preferences.

The browser floor is Chrome/Edge 90, Firefox 90 and Safari 15 (old workstations): Tailwind 3, colours computed to
plain RGB, and a CSS shim for the parts of AG Grid's stylesheet those browsers cannot read.
