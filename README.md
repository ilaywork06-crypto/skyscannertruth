# Skyscanner + Truth

Two systems, one repository, one look.

**[Skyscanner](skyscanner/README.md)** is the inventory of the events that produce files: every event, the entities
nested inside it, and every raw, parsed and additional file that belongs to them.

**[Truth](truth/README.md)** is the register of working assumptions: the conditions, figures and behaviours a
project is planned on, filed by industry and declared by schemas. Truth is a client only; the assumptions API it
talks to lives elsewhere (a stand-in ships here for working on the client alone).

Both clients are Vue 3 applications built on one design system, the Lattice look: a sidebar shell, calm cards,
the Indigo colour theme (plus Classic and seven pastel themes), light/dark/system, and English/Hebrew with the whole
page mirrored in Hebrew.

```
libraries/
├── ui/                 @truth-platform/ui - design system: tokens, Tailwind preset, components, i18n, bidi, toasts
└── grid/               @truth-platform/grid - AG Grid 33: token theme, old-browser CSS shim, column parsing,
                        server-side controller, cells, set filter, quick filters, pagination
skyscanner/
├── backend/            uv workspace members: sky_core, sky_grid, events / storage / notification services + tests
├── web/                the inventory client (Vue)
└── docker/             compose: MongoDB, MinIO, MailHog, the three services, the web client
truth/
├── web/                the register client (Vue)
├── mock-api/           in-memory stand-in for the assumptions API (Python stdlib only)
└── docker/             the client in front of the stand-in, or in front of your API
docs/                   architecture notes and the Hebrew user guide
```

## Running

```bash
cd skyscanner/docker && docker compose up --build     # http://localhost:8080
cd truth/docker      && docker compose up --build     # http://localhost:8090
```

For development:

```bash
npm install                 # every TypeScript workspace
uv sync --all-packages      # every Python workspace member

npm run dev                 # Skyscanner client on :5173 (proxies to the services on 8000/8001/8002)
npm run dev:truth           # Truth client on :5174 (proxies to TRUTH_API_URL)
python3 truth/mock-api/mock_api.py   # the Truth stand-in
```

## Checks

```bash
npm run type-check && npm test && npm run build
uv run ruff check . && uv run ruff format --check . && uv run mypy
uv run pytest                                   # needs MongoDB; TEST_MONGO_URI, default mongodb://localhost:27017
python -m unittest discover -s truth/mock-api -p "test_*.py"
```

CI runs all of the above (`.github/workflows/ci.yml`).

## Compatibility

This is a rewrite of the previous implementation and a drop-in replacement for it: the same HTTP API (paths,
parameters, JSON shapes, status codes), the same MongoDB collections and documents, the same bucket key layout, the
same environment variables and the same browser-stored saved views and upload resume state. Existing data and
scripts keep working. The deliberate behaviour changes are listed in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
