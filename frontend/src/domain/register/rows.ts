/**
 * Flattening assumptions into table rows.
 */

import type { AssumptionRecord } from '../models'
import type { RegisterRow } from './types'

/**
 * Flatten one assumption. A row is built from the listing straight away; its values and industries appear
 * once the assumption's own reading has landed.
 */
const toRegisterRow = (record: AssumptionRecord): RegisterRow => {
  const detail = record.detail

  return {
    id: record.id,
    name: record.name,
    assumption_text: record.assumption_text,
    proposing_party: record.proposing_party,
    tags: record.tags,
    validation_responsible_parties: record.validation_responsible_parties,
    revision: record.revision,
    creator: record.creator,
    created_at: record.created_at,
    schemas: record.schemas.map((schema) => schema.name),
    schema_ids: record.schemas.map((schema) => schema.id),
    industries: detail?.industries.map((industry) => industry.name) ?? [],
    industry_ids: detail?.industries.map((industry) => industry.id) ?? [],
    revision_reason: detail?.revision_reason ?? '',
    archived: detail?.archived ?? false,
    deleted: detail?.deleted ?? false,
    complete: detail !== null,
    values: detail?.values ?? {},
  }
}

/** Whether a row is filed under an industry, matched by id or by name. */
const rowInIndustry = (row: RegisterRow, industry: string): boolean =>
  row.industry_ids.includes(industry) || row.industries.includes(industry)

export { rowInIndustry, toRegisterRow }
