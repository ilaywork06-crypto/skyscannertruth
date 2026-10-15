/**
 * The payloads of the assumptions API, exactly as it shapes them. Nothing here may be written as though the
 * API returned more than it does: an industry is an id and a name, a listed schema carries no scheme, and a
 * listed assumption carries neither its values nor its industries.
 */
import type { JsonValue } from '@truth-platform/ui'

export type { JsonValue }

export interface Industry {
  id: string
  name: string
}

export interface IndustryDraft {
  name: string
  description: string
  creator: string
}

/** A scheme as the service stores it: free-form field dictionaries (and constraints the client never edits). */
export interface StoredScheme {
  fields: Record<string, JsonValue>[]
  constraints?: Record<string, JsonValue>[]
}

export interface SchemaSummary {
  id: string
  name: string
  revision: number
  creator: string
  created_at: string
}

export interface SchemaDetail extends SchemaSummary {
  description: string
  revision_reason: string
  latest_revision: boolean
  scheme: StoredScheme
  archived: boolean
  deleted: boolean
  industries: Industry[]
  /** Absent on services older than the flag; see `appliesEverywhere`. */
  global?: boolean
}

export interface SchemaDraft {
  name: string
  description: string
  /** Held by the service as a number with no vocabulary; always 0. */
  type: number
  scheme: StoredScheme
  creator: string
  /** uuids or names; [] for a global schema. */
  industries: string[]
  global: boolean
}

export interface SchemaRevisionDraft {
  creator: string
  revision_reason: string
  scheme: StoredScheme
}

export interface AssumptionSummary {
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

export interface AssumptionDetail extends Omit<AssumptionSummary, 'schemas'> {
  schemas: SchemaDetail[]
  values: Record<string, JsonValue>
  revision_reason: string
  aggregated_scheme: Record<string, JsonValue>[]
  archived: boolean
  deleted: boolean
  industries: Industry[]
}

export interface AssumptionDraft {
  name: string
  assumption_text: string
  proposing_party: string
  /** uuids (or names) of the schemas. */
  schemas: string[]
  values: Record<string, JsonValue>
  tags: string[]
  validation_responsible_parties: string[]
  creator: string
  /** names (or uuids) of the industries. */
  industries: string[]
  /** Reserved by the service; always sent empty. */
  special_fields: Record<string, JsonValue>
}

/** A listed assumption, completed later by its own reading. */
export interface AssumptionRow extends AssumptionSummary {
  detail: AssumptionDetail | null
}

/** A global schema applies everywhere; so does a legacy one naming no industry. */
export const appliesEverywhere = (schema: Pick<SchemaDetail, 'global' | 'industries'>): boolean =>
  schema.global === true || (schema.industries ?? []).length === 0
