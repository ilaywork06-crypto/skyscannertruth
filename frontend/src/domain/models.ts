/**
 * The API payloads, exactly as the service shapes them. No behaviour lives here.
 */

import type { JsonObject, JsonValue } from './json'

/** An industry. The service stores a description and creator but never returns them. */
interface Industry {
  id: string
  name: string
}

interface IndustryDraft {
  name: string
  description: string
  creator: string
}

/**
 * A scheme as the service stores it. Fields are free-form dictionaries (see `domain/scheme.ts`).
 * The service reads and answers constraints under `constraints`; they are always sent empty.
 */
interface StoredScheme {
  fields: JsonObject[]
  constraints?: JsonObject[]
}

interface SchemaSummary {
  id: string
  name: string
  revision: number
  creator: string
  created_at: string
}

interface SchemaDetail extends SchemaSummary {
  description: string
  revision_reason: string
  latest_revision: boolean
  scheme: StoredScheme
  archived: boolean
  deleted: boolean
  /** Empty only for legacy "global" schemas, which apply to every industry. */
  industries: Industry[]
}

interface SchemaDraft {
  name: string
  description: string
  /** Held by the service as a number with no vocabulary; always 0. */
  type: number
  scheme: StoredScheme
  creator: string
  /** At least one industry, by id or name. */
  industries: string[]
}

interface SchemaRevisionDraft {
  creator: string
  revision_reason: string
  scheme: StoredScheme
}

/** An assumption as listed: no values and no industries. */
interface AssumptionSummary {
  id: string
  name: string
  assumption_text: string
  proposing_party: string
  tags: string[]
  validation_responsible_parties: string[]
  revision: number
  creator: string
  created_at: string
  schemas: SchemaSummary[]
}

/** An assumption read on its own (`/latest`), the only shape carrying values and industries. */
interface AssumptionDetail extends Omit<AssumptionSummary, 'schemas'> {
  schemas: SchemaDetail[]
  values: Record<string, JsonValue>
  revision_reason: string
  aggregated_scheme: JsonObject[]
  archived: boolean
  deleted: boolean
  industries: Industry[]
}

interface AssumptionDraft {
  name: string
  assumption_text: string
  proposing_party: string
  schemas: string[]
  values: Record<string, JsonValue>
  tags: string[]
  validation_responsible_parties: string[]
  creator: string
  industries: string[]
  special_fields: Record<string, JsonValue>
}

/** A listed assumption plus its detail once read. */
interface AssumptionRecord extends AssumptionSummary {
  detail: AssumptionDetail | null
}

/** Whether a (legacy) schema names no industry and therefore applies to all of them. */
const appliesEverywhere = (schema: Pick<SchemaDetail, 'industries'>): boolean =>
  (schema.industries ?? []).length === 0

/** Whether a schema applies to any of the given industry ids or names. */
const schemaAppliesTo = (schema: Pick<SchemaDetail, 'industries'>, identifiers: string[]): boolean => {
  if (appliesEverywhere(schema)) {
    return true
  }
  const wanted = new Set(identifiers)

  return schema.industries.some((industry) => wanted.has(industry.id) || wanted.has(industry.name))
}

export type {
  AssumptionDetail,
  AssumptionDraft,
  AssumptionRecord,
  AssumptionSummary,
  Industry,
  IndustryDraft,
  SchemaDetail,
  SchemaDraft,
  SchemaRevisionDraft,
  SchemaSummary,
  StoredScheme,
}
export { appliesEverywhere, schemaAppliesTo }
