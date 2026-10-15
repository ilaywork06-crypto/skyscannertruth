# Truth

A register of working assumptions, filed by **industry** and declared by **schemas**. This folder holds the web
client and an in-memory stand-in for the assumptions API; the API itself is external.

```
truth/
├── web/        Vue 3 client (Lattice look: @truth-platform/ui, AG Grid via @truth-platform/grid)
├── mock-api/   mock_api.py - stdlib-only stand-in with the real API's contract and quirks (+ its test)
└── docker/     client image (nginx + /api proxy), mock image, compose files
```

## Run

**Client + stand-in, in Docker** (open `http://<this machine>:8090`):

```bash
cd truth/docker && docker compose up --build
```

**Client in front of your own API:**

```bash
cd truth/docker
TRUTH_API_URL=http://<where your API answers>/ docker compose -f docker-compose.frontend.yml up --build
```

The trailing slash matters: it strips the `/api` prefix, so `/api/assumption` reaches the API as `/assumption`.

**Developing:**

```bash
npm install                              # repository root
python3 truth/mock-api/mock_api.py       # or point TRUTH_API_URL at a real service
npm run dev:truth                        # http://localhost:5174
```

**Checks:**

```bash
npm run type-check --workspace @truth-platform/truth-web
npm run build --workspace @truth-platform/truth-web
python -m unittest discover -s truth/mock-api -p "test_*.py"
```

| Variable | Used by | Meaning |
| --- | --- | --- |
| `TRUTH_API_URL` | dev server, nginx | Where `/api` is forwarded (dev default `http://localhost:8000`; in Docker it must end with `/`). |
| `TRUTH_ALLOWED_HOSTS` | dev server | Extra host names it answers to (comma-separated, `.example.com` for subdomains, `all` to disable). |
| `VITE_API_BASE_URL` | build | The browser's API base, default `/api`. |
| `VITE_DEFAULT_CREATOR` | build | Who every write is made as (no user management); empty means `unknown`. Docker: `TRUTH_DEFAULT_CREATOR`. |
| `TRUTH_PORT` | compose | Published port, default `8090`. |
| `MOCK_API_HOST` / `MOCK_API_PORT` | mock | Bind address, default `127.0.0.1:8000` (`0.0.0.0` in the image). |

## How it works with the API

The API offers only `GET/POST /industry`, `/schema`, `/assumption`, the item reads (`/{id}`, `/{id}/latest`,
`/name/{name}`) and `POST /schema/{id}/revisions` - no search, filter, ordering, totals, PATCH or DELETE. So the
client reads every listing whole (pages of 100 until a short page), reads each schema whole, and reads each
assumption again (`/latest`, six at a time) because the listing carries neither values nor industries. The
table is usable meanwhile; search, filters, sort and paging all run in the browser.

Browser storage: `truth.industry.last` (where you left off - same key as before), plus the shared preference
keys `truth.theme`, `truth.accent`, `truth.lang` (the old `truth.theme=truthDark|truthLight` and `ui.language`
are migrated on first load).
