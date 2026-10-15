# Architecture

## Shape

```
          browser (Vue clients, one design system)
             │
        nginx (per client) ── identity headers from the authenticating proxy, passed through on every location
     ┌───────┼──────────────────────────┐
  /api   /api/storage            /api/notifications
 events   storage                 notifications
 :8000    :8001                   :8002
   │   └──► S3 / MinIO ◄──┘          │
   └──────► MongoDB ◄────────────────┘   (outbox written by events, drained by notifications)

 Truth client ── /api ──► the external assumptions API (or truth/mock-api)
```

### Backend (`skyscanner/backend`)

Each service is layered the same way:

- `api/`: thin FastAPI routers. One handler calls one use case. No database access.
- `services/`: use cases. Orchestrate repositories and domain rules.
- `repositories/`: the only code that touches MongoDB (and, for storage, S3).
- `domain/`: pure rules with no I/O (brief, dynamic values, status, artifacts, change tracking, renames). Unit-tested directly.
- `wiring.py`: builds the dependencies once per request.
- `bootstrap.py`: migrations and indexes at start-up.

Shared packages:

- `sky_core`: settings (env names unchanged), logging, the Mongo provider, identity and permissions, the error
  envelope (`{"detail": ...}` with the original status map), the app factory, the S3 client and every pydantic API
  model.
- `sky_grid`: generates grid columns and their version hash, and translates AG Grid filter/sort/search models into Mongo queries.

### Clients

- `libraries/ui`: the Lattice design system in Vue.
  - Colour tokens are computed per theme and mode into `rgb` channels and injected as one `<style>`. An inline
    pre-paint script prevents a flash of the wrong theme.
  - Built on reka-ui primitives, lucide icons and vue-sonner toasts.
  - Includes its own i18n, which wraps interpolated values in bidi isolates, and `useConfirm` / `useDirtyGuard`.
- `libraries/grid`: AG Grid 33 integration.
  - The grid theme is built from the same tokens.
  - A CSS compatibility shim covers Chrome/Edge/Firefox 90 and Safari 15.
  - Includes column parsing (Hebrew headers, pinning to the reading side), a server-side controller with request
    serials, detail rows, chip/value/link cells, a set filter, quick filters, active-filter chips and pagination.
- Each client:
  - Vite 6, vue-router and @tanstack/vue-query.
  - A fetch client that maps the error envelope to `ApiError`.
  - Its own dictionary registered over the shared one; the Hebrew wording is carried over verbatim from the previous clients.

## Compatibility

The same HTTP API, MongoDB collections and documents, bucket keys, environment variables and browser-stored user
data (saved views, upload resume) as the previous implementation. Additive fields only: outbox rows gain
`delivered_to` and `failure`.

## Deliberate behaviour changes

### Backend

1. **Renames update saved views.** Renaming a field, type or platform also rewrites the saved views that name it:
   their filters, sort and columns. The dry run counts the views it would change.
2. **409 for keys held by deleted items.** Re-creating a key or name that a soft-deleted document still holds
   answers 409 with a clear message instead of a raw 500. The same applies to renaming a saved view onto a name
   that is already taken.
3. **Bundle import reaches storage.** The import calls `STORAGE_SERVICE_URL` + `/api/storage/...`, and compose sets
   that variable. Before, it called localhost inside the container.
4. **Reachable download links.**
   - With `S3_PUBLIC_ENDPOINT_URL` set, temporary links are signed against it, so a browser can open them.
   - Without it, links stream through the storage service.
5. **`/dispatch` needs a permission.** `/api/notifications/dispatch` requires `subscription:manage`, and dispatch
   rounds no longer overlap.
6. **Mail retries and bad outbox rows.** A partly failed mailing is not sent again to people who already received
   it. A malformed outbox row is marked failed instead of blocking the queue.
7. **416 for impossible ranges.** A byte range past the end answers 416 with `Content-Range: bytes */size`.
8. **TLS checks on S3.** S3 certificates are verified by default; set `S3_VERIFY_TLS=false` to turn this off.
9. **Exports.**
   - CSV export of lists of numbers works.
   - CSV/JSON exports are streamed with no 10,000-event cap.
   - The bundle and file-archive manifests are still capped, because each is a single JSON document.
10. **Filters on fixed keys.** Filtering on `id`, `event_type_keys`, `entity_counts` and `objects.object_type_key`
    works. These are fixed keys, not `data.*`.
11. **422 for bad paging.** A bad `page` or `page_size` answers 422, not 500.

### Infrastructure

12. **nginx keeps identity on storage requests.** A `proxy_set_header` inside a location drops the server-level
    ones, so the storage location used to lose the identity and forwarding headers. It now repeats them.

### Clients

13. **Truth's table filters.** Set-filter values now update as rows load. AG Grid's own filters no longer
    re-filter an already filtered page. Date filters compare calendar days, and ranges include both ends.
14. **Truth's proxy errors.** A 502/503/504 without a body reads "The server could not be reached".
15. **Skyscanner's sort survives filtering.** Changing a filter while sorted by "created at" keeps the sort.
16. **Skyscanner's "save the current view first?"** The question now has a real Cancel.
17. **Confirmations above dialogs.** Confirmation prompts always open above the dialog that asked.
18. **Skyscanner's event page errors.** A failed load shows an error with Retry instead of an endless spinner.

### Kept on purpose

- **Anonymous callers.** A caller without identity headers is still an administrator by default
  (`AUTH_ALLOW_ANONYMOUS=true`, `AUTH_ANONYMOUS_ROLES=admin`), for compatibility. This is documented in the READMEs
  and `.env.example`.
- **Truth's spreadsheet export** covers the current page, as before.

## Look and behaviour changes

- **Layout.** Both clients use the Lattice sidebar shell. Hebrew mirrors the whole page; the previous clients kept
  the page left-to-right.
- **Themes.** Indigo is the default colour theme, with Classic and seven pastels, in light, dark or system mode.
- **Truth preferences.** Truth follows the system light/dark setting instead of always opening dark. Its old
  `truth.theme` and `ui.language` values are migrated on first load.
