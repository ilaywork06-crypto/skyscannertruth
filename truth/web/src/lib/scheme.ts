/**
 * A scheme read generously and written strictly.
 *
 * The API types a scheme's fields as `list[dict[str, JsonValue]]` and promises nothing about the keys, so every
 * field is read through lists of aliases (a key may be called `field`, a type `list[str]`, a whole field may be
 * `{"speed": "number"}`), and every key this client does not own is carried back out untouched. Written back,
 * a field always carries `key`, `display_name`, `type`, `required` and `array` (real booleans), then what its
 * kind calls for; constraints always go out empty.
 */
import { hasAName, humanizeKey, isValidKey, joinNames, splitNames, usePreferences, type NamePair } from '@truth-platform/ui'
import type { JsonValue, StoredScheme } from '@/models'

export type SchemeFieldType =
  | 'string' | 'boolean' | 'confined_number' | 'confined_float' | 'enum' | 'ultra_enum' | 'date' | 'multi_field'

/** How a field is drawn in a cell: the grid library's column types. */
export type RenderType = 'string' | 'boolean' | 'integer' | 'number' | 'enum' | 'date' | 'json'

export interface SchemeField {
  key: string
  displayName: string
  displayNameHebrew: string
  type: SchemeFieldType
  required: boolean
  array: boolean
  options: string[]
  min: number | null
  max: number | null
  step: number | null
  order: number
  /** Every key of the stored field this client does not own, kept for the round trip. */
  extras: Record<string, JsonValue>
}

export interface Scheme {
  fields: SchemeField[]
}

const KEY_ALIASES = ['key', 'name', 'field', 'field_name', 'id']
const NAME_ALIASES = ['display_name', 'displayName', 'label', 'title', 'display', 'caption']
export const HEBREW_NAME_ALIASES = [
  'display_name_he', 'displayNameHe', 'display_name_hebrew', 'displayNameHebrew', 'hebrew_display_name', 'label_he',
  'title_he', 'name_he', 'nameHe', 'hebrew_name', 'he_name', 'he', 'hebrew',
]
const TYPE_ALIASES = ['type', 'field_type', 'data_type', 'kind']
const OPTION_ALIASES = ['options', 'choices', 'enum', 'values', 'allowed', 'allowed_values']
const REQUIRED_ALIASES = ['required', 'mandatory', 'is_required']
const ARRAY_ALIASES = ['array', 'multiple', 'is_list', 'many', 'repeated']

const TYPE_BY_NAME: Record<string, SchemeFieldType> = {
  string: 'string', str: 'string', text: 'string',
  boolean: 'boolean', bool: 'boolean',
  confined_number: 'confined_number', 'confined number': 'confined_number', number: 'confined_number', int: 'confined_number', integer: 'confined_number',
  confined_float: 'confined_float', 'confined float': 'confined_float', float: 'confined_float', double: 'confined_float', decimal: 'confined_float',
  enum: 'enum', select: 'enum', choice: 'enum',
  ultra_enum: 'ultra_enum', 'ultra enum': 'ultra_enum', ultraenum: 'ultra_enum',
  date: 'date', datetime: 'date',
  multi_field: 'multi_field', 'multi field': 'multi_field', multifield: 'multi_field',
}

const OWNED_KEYS = new Set([
  ...KEY_ALIASES, ...NAME_ALIASES, ...HEBREW_NAME_ALIASES, ...TYPE_ALIASES, ...OPTION_ALIASES, ...REQUIRED_ALIASES,
  ...ARRAY_ALIASES, 'min', 'max', 'step',
])
const FALLBACK_TYPE: SchemeFieldType = 'string'
const ARRAY_TYPE_NAMES = ['list', 'array', 'set', 'tuple', 'sequence']

const RENDER_TYPES: Record<SchemeFieldType, RenderType> = {
  string: 'string', boolean: 'boolean', confined_number: 'integer', confined_float: 'number', enum: 'enum',
  ultra_enum: 'enum', date: 'date', multi_field: 'json',
}
export const TYPE_LABELS: Record<SchemeFieldType, string> = {
  string: 'STRING', boolean: 'BOOL', confined_number: 'INT', confined_float: 'FLOAT', enum: 'ENUM',
  ultra_enum: 'ULTRA ENUM', date: 'DATE', multi_field: 'MULTI FIELD',
}
/** What the builder offers for a new field; ULTRA ENUM and MULTI FIELD are kept only where they already are. */
export const OFFERED_TYPES: SchemeFieldType[] = ['string', 'boolean', 'confined_number', 'confined_float', 'enum', 'date']
const NUMERIC_TYPES: SchemeFieldType[] = ['confined_number', 'confined_float']
export const OPTION_TYPES: SchemeFieldType[] = ['enum', 'ultra_enum']

export const typeLabel = (type: SchemeFieldType): string => TYPE_LABELS[type] ?? String(type).toUpperCase()
export const renderType = (type: SchemeFieldType): RenderType => RENDER_TYPES[type] ?? 'string'
export const isNumeric = (type: SchemeFieldType): boolean => NUMERIC_TYPES.includes(type)
export const hasOptions = (type: SchemeFieldType): boolean => OPTION_TYPES.includes(type)

function readString(raw: Record<string, JsonValue>, aliases: string[]): string | null {
  for (const alias of aliases) {
    const v = raw[alias]
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  return null
}

function readFlag(raw: Record<string, JsonValue>, aliases: string[]): boolean {
  for (const alias of aliases) {
    const v = raw[alias]
    if (typeof v === 'boolean') return v
    if (typeof v === 'string') return ['true', 'yes', '1'].includes(v.trim().toLowerCase())
    if (typeof v === 'number') return v !== 0
  }
  return false
}

function readNumber(raw: Record<string, JsonValue>, key: string): number | null {
  const v = raw[key]
  if (typeof v === 'number') return v
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }
  return null
}

function readOptions(raw: Record<string, JsonValue>): string[] {
  for (const alias of OPTION_ALIASES) {
    const v = raw[alias]
    if (Array.isArray(v)) return v.filter((item) => item !== null && typeof item !== 'object').map((item) => String(item))
  }
  return []
}

export function readType(raw: Record<string, JsonValue>): { type: SchemeFieldType; array: boolean } {
  const written = readString(raw, TYPE_ALIASES)
  const declaredArray = readFlag(raw, ARRAY_ALIASES)
  if (written === null) return { type: readOptions(raw).length > 0 ? 'enum' : FALLBACK_TYPE, array: declaredArray }
  const lowered = written.toLowerCase().trim()
  const inner = /^(?:list|array|set|tuple|sequence)\s*(?:\[|<|\bof\b)\s*([a-z_ ]+)/.exec(lowered)
  if (inner) return { type: TYPE_BY_NAME[inner[1].trim()] ?? FALLBACK_TYPE, array: true }
  const suffixed = /^([a-z_ ]+?)\s*\[\s*\]$/.exec(lowered)
  if (suffixed) return { type: TYPE_BY_NAME[suffixed[1].trim()] ?? FALLBACK_TYPE, array: true }
  if (ARRAY_TYPE_NAMES.includes(lowered)) return { type: FALLBACK_TYPE, array: true }
  return { type: TYPE_BY_NAME[lowered] ?? FALLBACK_TYPE, array: declaredArray }
}

function buildField(input: { key: string; displayName: string; raw: Record<string, JsonValue>; order: number }): SchemeField {
  const { type, array } = readType(input.raw)
  return {
    key: input.key,
    displayName: input.displayName,
    displayNameHebrew: readString(input.raw, HEBREW_NAME_ALIASES) ?? '',
    type,
    array,
    required: readFlag(input.raw, REQUIRED_ALIASES),
    options: hasOptions(type) ? readOptions(input.raw) : [],
    min: isNumeric(type) ? readNumber(input.raw, 'min') : null,
    max: isNumeric(type) ? readNumber(input.raw, 'max') : null,
    step: isNumeric(type) ? readNumber(input.raw, 'step') : null,
    order: input.order,
    extras: Object.fromEntries(Object.entries(input.raw).filter(([k]) => !OWNED_KEYS.has(k))),
  }
}

export function readField(raw: Record<string, JsonValue>, order: number): SchemeField | null {
  const entries = Object.entries(raw)
  const named = readString(raw, KEY_ALIASES)
  // The shorthand `{"speed": "number"}`: the one entry is the key and its type.
  if (named === null && entries.length === 1 && typeof entries[0][1] === 'string') {
    const [key, written] = entries[0]
    return buildField({ key, displayName: humanizeKey(key), raw: { type: written }, order })
  }
  if (named === null) return null
  return buildField({ key: named, displayName: readString(raw, NAME_ALIASES) ?? humanizeKey(named), raw, order })
}

export function readScheme(stored: StoredScheme | null | undefined): Scheme {
  return {
    fields: (stored?.fields ?? [])
      .filter((raw): raw is Record<string, JsonValue> => raw !== null && typeof raw === 'object' && !Array.isArray(raw))
      .map((raw, i) => readField(raw, i))
      .filter((f): f is SchemeField => f !== null),
  }
}

export function writeField(field: SchemeField): Record<string, JsonValue> {
  const raw: Record<string, JsonValue> = {
    ...field.extras,
    key: field.key.trim(),
    display_name: field.displayName.trim(),
    type: field.type,
    required: field.required,
    array: field.array,
  }
  if (field.displayNameHebrew.trim().length > 0) raw.display_name_he = field.displayNameHebrew.trim()
  if (hasOptions(field.type)) raw.options = [...field.options]
  if (isNumeric(field.type)) {
    if (field.min !== null) raw.min = field.min
    if (field.max !== null) raw.max = field.max
    if (field.step !== null) raw.step = field.step
  }
  return raw
}

export function writeScheme(scheme: Scheme): StoredScheme {
  return { fields: scheme.fields.map(writeField), constraints: [] }
}

/** First declaration of a key wins; a later one only lends a name the first lacked. */
export function mergeFields(schemes: Scheme[]): SchemeField[] {
  const merged: SchemeField[] = []
  const at = new Map<string, number>()
  for (const scheme of schemes) {
    for (const field of scheme.fields) {
      const held = at.get(field.key)
      if (held === undefined) {
        at.set(field.key, merged.length)
        merged.push({ ...field, order: merged.length })
        continue
      }
      const first = merged[held]
      merged[held] = {
        ...first,
        displayName: first.displayName.trim().length > 0 ? first.displayName : field.displayName,
        displayNameHebrew: first.displayNameHebrew.trim().length > 0 ? first.displayNameHebrew : field.displayNameHebrew,
      }
    }
  }
  return merged
}

/** The name a person reads: the declared Hebrew one on a Hebrew page, else the declared name, else the key. */
export function fieldLabel(field: SchemeField): string {
  if (usePreferences().language.value === 'he' && field.displayNameHebrew.trim().length > 0) return field.displayNameHebrew.trim()
  return field.displayName.length > 0 ? field.displayName : humanizeKey(field.key)
}

export const fieldNames = (field: SchemeField): NamePair => splitNames({ name: field.displayName, name_he: field.displayNameHebrew })

export function withNames(field: SchemeField, pair: NamePair): SchemeField {
  const joined = joinNames(pair)
  return { ...field, displayName: joined.name, displayNameHebrew: joined.name_he }
}

/** The first thing wrong with a field, as a dictionary key, or null. */
export function fieldProblem(field: SchemeField, others: string[]): string | null {
  const key = field.key.trim()
  if (key.length === 0) return 'schemas.keyRequired'
  if (!isValidKey(key)) return 'names.keyEnglish'
  if (others.includes(key)) return 'names.keyTaken'
  if (!hasAName(fieldNames(field))) return 'names.required'
  if (hasOptions(field.type) && field.options.length === 0) return 'schemas.optionsRequired'
  return null
}

export function isSchemeValid(scheme: Scheme): boolean {
  return scheme.fields.every(
    (field, i) => fieldProblem(field, scheme.fields.filter((_, at) => at !== i).map((o) => o.key.trim())) === null,
  )
}

export function newField(order: number): SchemeField {
  return {
    key: '', displayName: '', displayNameHebrew: '', type: 'string', required: false, array: false, options: [],
    min: null, max: null, step: null, order, extras: {},
  }
}
