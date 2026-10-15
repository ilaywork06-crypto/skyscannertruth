/** An assumption flattened into the row shape the columns address. Industries and values come with the detail. */
import type { GridRow, JsonValue } from '@truth-platform/grid'
import type { AssumptionRow } from '@/models'

export function assumptionToRow(a: AssumptionRow): GridRow {
  const d = a.detail
  return {
    id: a.id,
    name: a.name,
    assumption_text: a.assumption_text,
    proposing_party: a.proposing_party,
    tags: a.tags,
    validation_responsible_parties: a.validation_responsible_parties,
    revision: a.revision,
    creator: a.creator,
    created_at: a.created_at,
    schemas: a.schemas.map((s) => s.name),
    schema_ids: a.schemas.map((s) => s.id),
    industries: d === null ? [] : d.industries.map((i) => i.name),
    industry_ids: d === null ? [] : d.industries.map((i) => i.id),
    revision_reason: d?.revision_reason ?? '',
    archived: d?.archived ?? false,
    deleted: d?.deleted ?? false,
    complete: d !== null,
    values: (d?.values ?? {}) as JsonValue,
  }
}
