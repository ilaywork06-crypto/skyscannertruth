/**
 * Bundles: a register written out whole, in the shapes the API creates things in, and read back elsewhere.
 *
 * Everything is named rather than identified, since ids mean nothing in another register. Restoring runs in
 * three passes - industries, schemas, assumptions - because each names the ones before it.
 */

import type { JsonObject, JsonValue } from './json'
import { isRecord } from './json'
import type { AssumptionDetail, AssumptionDraft, Industry, SchemaDetail, StoredScheme } from './models'

const BUNDLE_FORMAT = 'truth.register.bundle'
const BUNDLE_VERSION = 1

interface BundledIndustry {
  name: string
  description: string
  creator: string
}

interface BundledSchema {
  name: string
  description: string
  type: number
  scheme: StoredScheme
  creator: string
  /** Older bundles may name none; those are restored under the bundle's own industry. */
  industries: string[]
}

/** `revision` and `created_at` are informational - the API stamps both itself. */
interface BundledAssumption {
  name: string
  assumption_text: string
  proposing_party: string
  schemas: string[]
  industries: string[]
  values: Record<string, JsonValue>
  tags: string[]
  validation_responsible_parties: string[]
  creator: string
  special_fields: Record<string, JsonValue>
  revision: number
  created_at: string
}

interface Bundle {
  format: string
  version: number
  created_at: string
  /** The industry the register was read under when taken. */
  industry: string | null
  industries: BundledIndustry[]
  schemas: BundledSchema[]
  assumptions: BundledAssumption[]
}

/** What restoring a bundle into the current register would create. */
interface RestorePlan {
  industries: BundledIndustry[]
  schemas: BundledSchema[]
  assumptions: BundledAssumption[]
  /** Assumptions already present (same name and text), left alone. */
  skipped: number
  total: number
}

const buildBundle = (input: {
  industry: string | null
  industries: Industry[]
  schemas: SchemaDetail[]
  assumptions: AssumptionDetail[]
  creator: string
}): Bundle => ({
  format: BUNDLE_FORMAT,
  version: BUNDLE_VERSION,
  created_at: new Date().toISOString(),
  industry: input.industry,
  industries: input.industries.map((industry) => ({ name: industry.name, description: '', creator: input.creator })),
  /* The scheme travels exactly as stored, not as this client read it. */
  schemas: input.schemas.map((schema) => ({
    name: schema.name,
    description: schema.description,
    type: 0,
    scheme: schema.scheme,
    creator: schema.creator,
    industries: (schema.industries ?? []).map((industry) => industry.name),
  })),
  assumptions: input.assumptions.map((assumption) => ({
    name: assumption.name,
    assumption_text: assumption.assumption_text,
    proposing_party: assumption.proposing_party,
    schemas: assumption.schemas.map((schema) => schema.name),
    industries: assumption.industries.map((industry) => industry.name),
    values: assumption.values,
    tags: [...assumption.tags],
    validation_responsible_parties: [...assumption.validation_responsible_parties],
    creator: assumption.creator,
    special_fields: {},
    revision: assumption.revision,
    created_at: assumption.created_at,
  })),
})

const timestamp = (): string => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')

const bundleFileName = (industry: string | null): string => {
  const scope = industry === null ? '' : `-${industry.replace(/[^\w-]+/g, '-').toLowerCase()}`

  return `truth-bundle${scope}-${timestamp()}.json`
}

const writeBundle = (bundle: Bundle): string => JSON.stringify(bundle, null, 2)

const readStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

const readText = (raw: Record<string, unknown>, key: string): string => {
  const value = raw[key]

  return typeof value === 'string' ? value : ''
}

const readScheme = (value: unknown): StoredScheme => ({
  fields: isRecord(value) && Array.isArray(value.fields) ? value.fields.filter((field): field is JsonObject => isRecord(field)) : [],
})

/** Parse a bundle file, or `null` when it is not one. Missing parts read as empty. */
const readBundle = (text: string): Bundle | null => {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.format !== BUNDLE_FORMAT) {
    return null
  }

  const list = (key: string) => (Array.isArray(parsed[key]) ? (parsed[key] as unknown[]).filter(isRecord) : [])

  return {
    format: BUNDLE_FORMAT,
    version: typeof parsed.version === 'number' ? parsed.version : BUNDLE_VERSION,
    created_at: readText(parsed, 'created_at'),
    industry: typeof parsed.industry === 'string' ? parsed.industry : null,
    industries: list('industries').map((raw) => ({
      name: readText(raw, 'name'),
      description: readText(raw, 'description'),
      creator: readText(raw, 'creator'),
    })),
    schemas: list('schemas').map((raw) => ({
      name: readText(raw, 'name'),
      description: readText(raw, 'description'),
      type: typeof raw.type === 'number' ? raw.type : 0,
      scheme: readScheme(raw.scheme),
      creator: readText(raw, 'creator'),
      industries: readStrings(raw.industries),
    })),
    assumptions: list('assumptions').map((raw) => ({
      name: readText(raw, 'name'),
      assumption_text: readText(raw, 'assumption_text'),
      proposing_party: readText(raw, 'proposing_party'),
      schemas: readStrings(raw.schemas),
      industries: readStrings(raw.industries),
      values: isRecord(raw.values) ? (raw.values as Record<string, JsonValue>) : {},
      tags: readStrings(raw.tags),
      validation_responsible_parties: readStrings(raw.validation_responsible_parties),
      creator: readText(raw, 'creator'),
      special_fields: {},
      revision: typeof raw.revision === 'number' ? raw.revision : 1,
      created_at: readText(raw, 'created_at'),
    })),
  }
}

/** Assumptions are considered the same when name and text match - what makes a re-run restore safe. */
const assumptionKey = (name: string, text: string): string => `${name.trim()}\u0000${text.trim()}`

/** Work out what a restore would create, given what the register already holds. */
const planRestore = (
  bundle: Bundle | null,
  held: { industries: string[]; schemas: string[]; assumptions: { name: string; text: string }[] },
): RestorePlan => {
  if (bundle === null) {
    return { industries: [], schemas: [], assumptions: [], skipped: 0, total: 0 }
  }
  const industries = new Set(held.industries)
  const schemas = new Set(held.schemas)
  const assumptions = new Set(held.assumptions.map((item) => assumptionKey(item.name, item.text)))

  const wanted = {
    industries: bundle.industries.filter((item) => !industries.has(item.name)),
    schemas: bundle.schemas.filter((item) => !schemas.has(item.name)),
    assumptions: bundle.assumptions.filter((item) => !assumptions.has(assumptionKey(item.name, item.assumption_text))),
  }

  return {
    ...wanted,
    skipped: bundle.assumptions.length - wanted.assumptions.length,
    total: wanted.industries.length + wanted.schemas.length + wanted.assumptions.length,
  }
}

/** Resolve names to ids from what the register holds; unknown names are sent as names. */
const nameResolver = (held: { id: string; name: string }[]) => {
  const byName = new Map(held.map((item) => [item.name, item.id]))

  return (name: string): string => byName.get(name) ?? name
}

const assumptionDraft = (
  bundled: BundledAssumption,
  fallbackCreator: string,
  resolve: { schema: (name: string) => string; industry: (name: string) => string },
): AssumptionDraft => ({
  name: bundled.name,
  assumption_text: bundled.assumption_text,
  proposing_party: bundled.proposing_party,
  schemas: bundled.schemas.map(resolve.schema),
  values: bundled.values,
  tags: [...bundled.tags],
  validation_responsible_parties: [...bundled.validation_responsible_parties],
  creator: bundled.creator || fallbackCreator,
  industries: bundled.industries.map(resolve.industry),
  special_fields: {},
})

export type { Bundle, BundledAssumption, BundledIndustry, BundledSchema, RestorePlan }
export {
  BUNDLE_FORMAT,
  assumptionDraft,
  assumptionKey,
  buildBundle,
  bundleFileName,
  nameResolver,
  planRestore,
  readBundle,
  timestamp,
  writeBundle,
}
