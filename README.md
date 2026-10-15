# Truth

A register of working assumptions — the conditions, figures and behaviours a project is planned on — filed by
industry and declared by schemas.

This repository holds the **web client** and an in-memory **stand-in API** for developing it. The real
assumptions API is yours and runs wherever you run it.

```
frontend/      Vue 3 + TypeScript + Vuetify client
mock-api/      in-memory stand-in for the API (python, no dependencies)
docker/        compose files: client + stand-in, or client in front of your API
```

## Running it

```bash
# 1. The stand-in API (or point TRUTH_API_URL at your own service)
python3 mock-api/mock_api.py                     # http://localhost:8000

# 2. The client
cd frontend
npm install
VITE_DEFAULT_CREATOR=you npm run dev             # http://localhost:5174
```

With Docker:

```bash
cd docker
docker compose up --build                                                      # client + stand-in on :8090
TRUTH_API_URL=http://<your-api>/ docker compose -f docker-compose.frontend.yml up --build   # client only
```

| Variable | Where | Purpose |
| --- | --- | --- |
| `TRUTH_API_URL` | dev server, nginx | Where the API is reached. The trailing slash strips the `/api` prefix. |
| `VITE_API_BASE_URL` | build | Where the browser sends requests. Defaults to `/api`. |
| `VITE_DEFAULT_CREATOR` | build | Who the client creates things as — the API authenticates nobody. |
| `TRUTH_ALLOWED_HOSTS` | dev server | Extra host names the dev server answers to (`all` disables the check). |
| `TRUTH_PORT` | compose | Published port (default `8090`). |

### Checks

```bash
cd frontend
npm run lint          # ESLint, zero warnings
npm run type-check    # vue-tsc, strict + noUncheckedIndexedAccess
npm test              # Vitest - the domain layer
npm run build
```

## Architecture

The client is split into layers that only depend downwards. Business rules live in plain TypeScript with no
Vue in them, so they are unit-tested in isolation and readable without knowing the UI.

```
src/
├── domain/          pure TypeScript - no Vue, no HTTP, no i18n
│   ├── models.ts        API payloads, exactly as the service shapes them
│   ├── scheme.ts        reading schema declarations generously, writing them strictly
│   ├── validation.ts    checking values against declared attributes (returns i18n keys)
│   ├── bundle.ts        export/import format and restore planning
│   └── register/        the table: types, column generation, query engine, URL codec, RowSource seam
├── api/             HTTP: one module per resource, paging, ApiError
├── stores/          Pinia: the register (loaded once), notifications, preferences
├── i18n/            English + Hebrew dictionaries (Hebrew is type-checked against English)
├── shared/          reusable UI (FormDialog, PageHeader, ValueChip, sidebar…) and utilities
├── features/        one folder per capability, each with its components and composables
│   ├── register/        table, filters, quick filters, detail panel, URL sync
│   ├── assumptions/     create / duplicate form
│   ├── schemas/         builder, form, cards
│   ├── industries/      card, form
│   └── bundle/          export and restore
├── pages/           thin route components that compose features
└── app/             App shell, router, Vuetify setup, design tokens, global styles
```

### How it works with the API

The API offers listings (`offset`/`limit`, bare arrays, no totals), single reads, and creation — no search,
filter, sort, `PATCH` or `DELETE`. Three things follow:

- **The register is read whole** (`stores/register.ts`), a page at a time until a page comes back short.
- **Listed assumptions lack values and industries**, so each is read on its own (six at a time) in the
  background; rows appear immediately and fill in as readings land, batched to avoid re-render storms.
- **Search, filters, sorting and paging run in the browser** through a `RowSource`
  (`domain/register/row-source.ts`). When the API learns to answer queries, a source that forwards the same
  `RegisterQuery` replaces the in-memory one and nothing else changes.

Schemes are read generously (`label`/`title`, `list[str]`, `{"speed": "number"}` shorthand) and written strictly:
the five required keys, the extras each type needs, and **every unknown key carried back untouched** so revising
a schema through this client never deletes data it does not understand.

| Shown as | Written as | Extras |
| --- | --- | --- |
| Text | `string` | |
| Yes / No | `boolean` | |
| Integer | `confined_number` | `min`, `max`, `step` when set |
| Decimal | `confined_float` | `min`, `max`, `step` when set |
| Choice | `enum` | `options` |
| Ultra choice | `ultra_enum` | `options` |
| Date | `date` | |
| Multi field | `multi_field` | kept as found; not offered for new attributes |

The API still requires an assumption `name`; the client derives it from the first line of the text (≤ 80
characters).

### Views in the address

What the table shows is kept in the URL, so a reload keeps it and a link shares it. Only what differs from the
defaults is written:

```
/industries/<id>?q=fuel
  &proposing_party.in=Engineering&proposing_party.in=Ops     <column>.<operator>, repeated for lists
  &created_at.between=2026-01-01&created_at.between=2026-02-01
  &sort=-created_at&sort=revision                            minus = descending, in priority order
  &page=2&size=50&hide=schemas
```

The way back from an assumption returns to the table exactly as it was left.

## Features

- **Industries** — overview with live counts; each opens its own register. `/` reopens the last one.
- **Register table** — schema-driven columns, pinned assumption column, multi-column sort (Shift+click),
  per-column filters (set / text / number / date), quick filters with counts, active-filter chips, search
  highlighting, column chooser, paging.
- **Row details** — parties (each one a one-click filter) and every attribute, inline.
- **Assumption page** — attributes grouped by schema, facts sidebar, copy link, duplicate.
- **Create** — one form; attribute inputs generated from the chosen industries' schemas, validated live.
- **Schemas** — searchable cards (by name, description or attribute), detail page, declare & revise with a
  builder (reorder, bilingual names, key auto-derived from the English name).
- **Export** — spreadsheet of the current view, or a bundle of the industry. **Import** — restores a bundle
  in three passes, skipping what already exists; safe to re-run.
- **Hebrew & RTL**, **dark & light themes**, responsive down to phone width.

## What is not here

- **Projects, file attachments, validation records** — the API has no resources for them.
- **Editing or deleting assumptions** — the API offers neither; schemas change by revision.
