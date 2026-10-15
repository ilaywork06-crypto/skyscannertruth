/**
 * The register as a bundle (`truth.register.bundle`, version 1): the industries, the schemas exactly as the
 * service stored them, and the assumptions with their values - everything named rather than identified, so a
 * bundle taken from one register restores into another that has never seen its uuids.
 */
import type { AssumptionDetail, AssumptionDraft, Industry, JsonValue, SchemaDetail, StoredScheme } from '@/models'

export const BUNDLE_FORMAT = 'truth.register.bundle'
export const BUNDLE_VERSION = 1
const FILE_PREFIX = 'truth-bundle'

export interface BundledIndustry {
  name: string
  description: string
  creator: string
}
export interface BundledSchema {
  name: string
  description: string
  type: number
  scheme: StoredScheme
  creator: string
  industries: string[]
  global: boolean
}
export interface BundledAssumption {
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
export interface Bundle {
  format: string
  version: number
  created_at: string
  industry: string | null
  industries: BundledIndustry[]
  schemas: BundledSchema[]
  assumptions: BundledAssumption[]
}

/** The API never returns an industry's description or creator, so the exporter's own creator is written. */
const bundleIndustry = (i: Industry, creator: string): BundledIndustry => ({ name: i.name, description: '', creator })

const bundleSchema = (s: SchemaDetail): BundledSchema => ({
  name: s.name,
  description: s.description,
  type: 0,
  scheme: s.scheme,
  creator: s.creator,
  industries: s.global === true ? [] : (s.industries ?? []).map((i) => i.name),
  global: s.global === true,
})

const bundleAssumption = (a: AssumptionDetail): BundledAssumption => ({
  name: a.name,
  assumption_text: a.assumption_text,
  proposing_party: a.proposing_party,
  schemas: a.schemas.map((s) => s.name),
  industries: a.industries.map((i) => i.name),
  values: a.values,
  tags: [...a.tags],
  validation_responsible_parties: [...a.validation_responsible_parties],
  creator: a.creator,
  special_fields: {},
  revision: a.revision,
  created_at: a.created_at,
})

export function buildBundle(input: {
  industry: string | null
  industries: Industry[]
  schemas: SchemaDetail[]
  assumptions: AssumptionDetail[]
  creator: string
}): Bundle {
  return {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    created_at: new Date().toISOString(),
    industry: input.industry,
    industries: input.industries.map((i) => bundleIndustry(i, input.creator)),
    schemas: input.schemas.map(bundleSchema),
    assumptions: input.assumptions.map(bundleAssumption),
  }
}

/** `20261014T101112Z` - the ISO moment without separators or milliseconds. */
export const fileStamp = (at = new Date()) => at.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')

export function bundleFileName(industry: string | null): string {
  const scope = industry === null ? '' : `-${industry.replace(/[^\w-]+/g, '-').toLowerCase()}`
  return `${FILE_PREFIX}${scope}-${fileStamp()}.json`
}

export const writeBundle = (bundle: Bundle): string => JSON.stringify(bundle, null, 2)

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const readStrings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const readText = (raw: Record<string, unknown>, key: string): string => (typeof raw[key] === 'string' ? (raw[key] as string) : '')
const readValues = (raw: Record<string, unknown>, key: string): Record<string, JsonValue> =>
  isRecord(raw[key]) ? (raw[key] as Record<string, JsonValue>) : {}

/** Only the fields of a bundled scheme are kept, so constraints are dropped on import. */
function readStoredScheme(v: unknown): StoredScheme {
  if (!isRecord(v)) return { fields: [] }
  return { fields: Array.isArray(v.fields) ? v.fields.filter((f): f is Record<string, JsonValue> => isRecord(f)) : [] }
}

/** A bundle read leniently; null when the text is not one. */
export function readBundle(text: string): Bundle | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(parsed) || parsed.format !== BUNDLE_FORMAT) return null
  const list = (k: string) => (Array.isArray(parsed[k]) ? (parsed[k] as unknown[]) : []).filter(isRecord)
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
      scheme: readStoredScheme(raw.scheme),
      creator: readText(raw, 'creator'),
      industries: readStrings(raw.industries),
      global: raw.global === true,
    })),
    assumptions: list('assumptions').map((raw) => ({
      name: readText(raw, 'name'),
      assumption_text: readText(raw, 'assumption_text'),
      proposing_party: readText(raw, 'proposing_party'),
      schemas: readStrings(raw.schemas),
      industries: readStrings(raw.industries),
      values: readValues(raw, 'values'),
      tags: readStrings(raw.tags),
      validation_responsible_parties: readStrings(raw.validation_responsible_parties),
      creator: readText(raw, 'creator'),
      special_fields: {},
      revision: typeof raw.revision === 'number' ? raw.revision : 1,
      created_at: readText(raw, 'created_at'),
    })),
  }
}

export type Resolver = (name: string) => string

/** A name to the id the register holds for it, or the name itself when it holds none. */
export function nameResolver(held: { id: string; name: string }[]): Resolver {
  const byName = new Map(held.map((i) => [i.name, i.id]))
  return (name) => byName.get(name) ?? name
}

export function assumptionDraft(b: BundledAssumption, fallbackCreator: string, resolve: { schema: Resolver; industry: Resolver }): AssumptionDraft {
  return {
    name: b.name,
    assumption_text: b.assumption_text,
    proposing_party: b.proposing_party,
    schemas: b.schemas.map(resolve.schema),
    values: b.values,
    tags: [...b.tags],
    validation_responsible_parties: [...b.validation_responsible_parties],
    creator: b.creator.length > 0 ? b.creator : fallbackCreator,
    industries: b.industries.map(resolve.industry),
    special_fields: {},
  }
}

/** Two assumptions are the same one when their name and text are. */
export const assumptionKey = (name: string, text: string): string => `${name.trim()}\u0000${text.trim()}`
