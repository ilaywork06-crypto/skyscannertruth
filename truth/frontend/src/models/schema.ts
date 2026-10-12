/**
 * The payloads of the schemas, which declare what attributes an assumption carries.
 */

import type { Industry } from './industry'
import type { StoredScheme } from './scheme'

/** A schema as the listing hands it over, which is everything but the declaration itself. */
interface SchemaSummary {
  id: string
  name: string
  revision: number
  creator: string
  created_at: string
}

/** A schema read on its own, which carries the declaration and everything around it. */
interface SchemaDetail extends SchemaSummary {
  description: string
  revision_reason: string
  latest_revision: boolean
  scheme: StoredScheme
  archived: boolean
  deleted: boolean
  industries: Industry[]
  /**
   * Whether the schema is shared by every industry and every table. Read as absent from a service that
   * predates it, which is why it is optional here - see `appliesEverywhere` for how such a schema is read.
   */
  global?: boolean
}

/** What creating a schema asks for. */
interface SchemaDraft {
  name: string
  description: string
  /** The kind of schema, which the service holds as a number and offers no vocabulary for. */
  type: number
  scheme: StoredScheme
  creator: string
  /*
   * Which industries the schema declares attributes for, each named by its identifier or by its name.
   *
   * The service resolves either, so the identifier is sent wherever this client holds one and the name only
   * where it does not. A global schema names none, because it belongs to all of them.
   */
  industries: string[]
  /** Whether the schema is shared by every industry and every table rather than declared for some of them. */
  global: boolean
}

/** What revising a schema asks for, which is a new declaration and the reason it was changed. */
interface SchemaRevisionDraft {
  creator: string
  revision_reason: string
  scheme: StoredScheme
}

/**
 * Whether a schema applies to every industry.
 *
 * A global schema does by definition. So does one that names no industry at all: that is what a schema
 * created before the flag existed meant by leaving its industries empty, and it keeps meaning it.
 */
const appliesEverywhere = (schema: Pick<SchemaDetail, 'global' | 'industries'>): boolean =>
  schema.global === true || (schema.industries ?? []).length === 0

export type { SchemaDetail, SchemaDraft, SchemaRevisionDraft, SchemaSummary }
export { appliesEverywhere }
