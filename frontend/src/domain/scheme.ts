/**
 * Reading and writing schema declarations.
 *
 * The API types a scheme's fields as `list[dict[str, JsonValue]]` and promises nothing about the keys, so
 * reading is generous (aliases, `list[str]`, `{"speed": "number"}` shorthand) and writing is strict: the five
 * required keys, the extras the field's type needs, and every unknown key carried back untouched.
 */

import type { JsonObject, JsonValue } from './json'
import { isRecord } from './json'
import type { StoredScheme } from './models'
import { humanizeKey, isValidKey } from './names'

/** The kinds of attribute the service accepts, as spelled on the wire. */
type FieldType =
  | 'string'
  | 'boolean'
  | 'confined_number'
  | 'confined_float'
  | 'enum'
  | 'ultra_enum'
  | 'date'
  | 'multi_field'

/** One declared attribute, as the client works with it. */
interface SchemeField {
  key: string
  displayName: string
  displayNameHebrew: string
  type: FieldType
  required: boolean
  array: boolean
  options: string[]
  min: number | null
  max: number | null
  step: number | null
  /** Every stored key this client does not own, carried through untouched. */
  extras: JsonObject
}

type Language = 'en' | 'he'

/** Why a field cannot be declared, as an i18n key. */
type FieldProblem =
  | 'schemas.problem.keyRequired'
  | 'schemas.problem.keyInvalid'
  | 'schemas.problem.keyTaken'
  | 'schemas.problem.nameRequired'
  | 'schemas.problem.optionsRequired'

const KEY_ALIASES = ['key', 'name', 'field', 'field_name', 'id']
const NAME_ALIASES = ['display_name', 'displayName', 'label', 'title', 'display', 'caption']
const HEBREW_NAME_ALIASES = [
  'display_name_he',
  'displayNameHe',
  'display_name_hebrew',
  'displayNameHebrew',
  'hebrew_display_name',
  'label_he',
  'title_he',
  'name_he',
  'nameHe',
  'hebrew_name',
  'he_name',
  'he',
  'hebrew',
]
const TYPE_ALIASES = ['type', 'field_type', 'data_type', 'kind']
const OPTION_ALIASES = ['options', 'choices', 'enum', 'values', 'allowed', 'allowed_values']
const REQUIRED_ALIASES = ['required', 'mandatory', 'is_required']
const ARRAY_ALIASES = ['array', 'multiple', 'is_list', 'many', 'repeated']

/** Keys this client writes (and every alias it reads them under) - everything else is an extra. */
const OWNED_KEYS = new Set([
  ...KEY_ALIASES,
  ...NAME_ALIASES,
  ...HEBREW_NAME_ALIASES,
  ...TYPE_ALIASES,
  ...OPTION_ALIASES,
  ...REQUIRED_ALIASES,
  ...ARRAY_ALIASES,
  'min',
  'max',
  'step',
])

const TYPE_BY_NAME: Record<string, FieldType> = {
  string: 'string',
  str: 'string',
  text: 'string',
  boolean: 'boolean',
  bool: 'boolean',
  confined_number: 'confined_number',
  'confined number': 'confined_number',
  number: 'confined_number',
  int: 'confined_number',
  integer: 'confined_number',
  confined_float: 'confined_float',
  'confined float': 'confined_float',
  float: 'confined_float',
  double: 'confined_float',
  decimal: 'confined_float',
  enum: 'enum',
  select: 'enum',
  choice: 'enum',
  ultra_enum: 'ultra_enum',
  'ultra enum': 'ultra_enum',
  ultraenum: 'ultra_enum',
  date: 'date',
  datetime: 'date',
  multi_field: 'multi_field',
  'multi field': 'multi_field',
  multifield: 'multi_field',
}

const FALLBACK_TYPE: FieldType = 'string'
const ARRAY_TYPE_NAMES = ['list', 'array', 'set', 'tuple', 'sequence']

/** Technical type names, shown the same in both languages. */
const TYPE_LABELS: Record<FieldType, string> = {
  string: 'Text',
  boolean: 'Yes / No',
  confined_number: 'Integer',
  confined_float: 'Decimal',
  enum: 'Choice',
  ultra_enum: 'Ultra choice',
  date: 'Date',
  multi_field: 'Multi field',
}

/** Types offered when declaring a new field (multi_field's shape is not defined yet). */
const DECLARABLE_TYPES: FieldType[] = ['string', 'boolean', 'confined_number', 'confined_float', 'enum', 'ultra_enum', 'date']

const isNumeric = (type: FieldType): boolean => type === 'confined_number' || type === 'confined_float'
const hasOptions = (type: FieldType): boolean => type === 'enum' || type === 'ultra_enum'
const typeLabel = (type: FieldType): string => TYPE_LABELS[type] ?? type

const readString = (raw: JsonObject, aliases: string[]): string | null => {
  for (const alias of aliases) {
    const value = raw[alias]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return null
}

const readFlag = (raw: JsonObject, aliases: string[]): boolean => {
  for (const alias of aliases) {
    const value = raw[alias]
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'string') {
      return ['true', 'yes', '1'].includes(value.trim().toLowerCase())
    }
    if (typeof value === 'number') {
      return value !== 0
    }
  }

  return false
}

const readNumber = (raw: JsonObject, key: string): number | null => {
  const value = raw[key]
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)

    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

const readOptions = (raw: JsonObject): string[] => {
  for (const alias of OPTION_ALIASES) {
    const value = raw[alias]
    if (Array.isArray(value)) {
      return value.filter((item) => item !== null && typeof item !== 'object').map(String)
    }
  }

  return []
}

/** Read the type and whether it holds several values; `list[str]` and `string[]` say both at once. */
const readType = (raw: JsonObject): { type: FieldType; array: boolean } => {
  const written = readString(raw, TYPE_ALIASES)
  const declaredArray = readFlag(raw, ARRAY_ALIASES)

  if (written === null) {
    return { type: readOptions(raw).length > 0 ? 'enum' : FALLBACK_TYPE, array: declaredArray }
  }

  const lowered = written.toLowerCase().trim()
  const wrapped = /^(?:list|array|set|tuple|sequence)\s*(?:\[|<|\bof\b)\s*([a-z_ ]+)/.exec(lowered)
  if (wrapped?.[1] !== undefined) {
    return { type: TYPE_BY_NAME[wrapped[1].trim()] ?? FALLBACK_TYPE, array: true }
  }

  const suffixed = /^([a-z_ ]+?)\s*\[\s*\]$/.exec(lowered)
  if (suffixed?.[1] !== undefined) {
    return { type: TYPE_BY_NAME[suffixed[1].trim()] ?? FALLBACK_TYPE, array: true }
  }

  if (ARRAY_TYPE_NAMES.includes(lowered)) {
    return { type: FALLBACK_TYPE, array: true }
  }

  return { type: TYPE_BY_NAME[lowered] ?? FALLBACK_TYPE, array: declaredArray }
}

const buildField = (key: string, displayName: string, raw: JsonObject): SchemeField => {
  const { type, array } = readType(raw)

  return {
    key,
    displayName,
    displayNameHebrew: readString(raw, HEBREW_NAME_ALIASES) ?? '',
    type,
    array,
    required: readFlag(raw, REQUIRED_ALIASES),
    options: hasOptions(type) ? readOptions(raw) : [],
    min: isNumeric(type) ? readNumber(raw, 'min') : null,
    max: isNumeric(type) ? readNumber(raw, 'max') : null,
    step: isNumeric(type) ? readNumber(raw, 'step') : null,
    extras: Object.fromEntries(Object.entries(raw).filter(([name]) => !OWNED_KEYS.has(name))),
  }
}

/** Read one stored field, or `null` when no key can be found in it. */
const readField = (raw: JsonObject): SchemeField | null => {
  const named = readString(raw, KEY_ALIASES)
  const entries = Object.entries(raw)
  const shorthand = entries[0]

  /* `{"speed": "number"}` - the shortest way anybody would write a field. */
  if (named === null && entries.length === 1 && shorthand !== undefined && typeof shorthand[1] === 'string') {
    return buildField(shorthand[0], humanizeKey(shorthand[0]), { type: shorthand[1] })
  }

  if (named === null) {
    return null
  }

  return buildField(named, readString(raw, NAME_ALIASES) ?? humanizeKey(named), raw)
}

/** Read a whole stored scheme into field descriptors. */
const readScheme = (stored: StoredScheme | null | undefined): SchemeField[] =>
  (stored?.fields ?? [])
    .filter((raw): raw is JsonObject => isRecord(raw))
    .map((raw) => readField(raw))
    .filter((field): field is SchemeField => field !== null)

/** Write one field in the exact shape the service stores. */
const writeField = (field: SchemeField): JsonObject => {
  const raw: JsonObject = {
    ...field.extras,
    key: field.key.trim(),
    display_name: field.displayName.trim(),
    type: field.type,
    required: field.required,
    array: field.array,
  }

  if (field.displayNameHebrew.trim().length > 0) {
    raw.display_name_he = field.displayNameHebrew.trim()
  }
  if (hasOptions(field.type)) {
    raw.options = [...field.options]
  }
  if (isNumeric(field.type)) {
    if (field.min !== null) raw.min = field.min
    if (field.max !== null) raw.max = field.max
    if (field.step !== null) raw.step = field.step
  }

  return raw
}

const writeScheme = (fields: SchemeField[]): StoredScheme => ({
  fields: fields.map((field) => writeField(field)),
  constraints: [],
})

/**
 * Merge several schemes into one list, one entry per key. The first declaration wins; a later one only
 * supplies a name the first was missing.
 */
const mergeFields = (schemes: SchemeField[][]): SchemeField[] => {
  const merged = new Map<string, SchemeField>()

  for (const field of schemes.flat()) {
    const held = merged.get(field.key)
    if (held === undefined) {
      merged.set(field.key, field)
      continue
    }
    merged.set(field.key, {
      ...held,
      displayName: held.displayName.trim() || field.displayName,
      displayNameHebrew: held.displayNameHebrew.trim() || field.displayNameHebrew,
    })
  }

  return [...merged.values()]
}

/** The label of a field in the given language. */
const fieldLabel = (field: SchemeField, language: Language): string => {
  if (language === 'he' && field.displayNameHebrew.trim().length > 0) {
    return field.displayNameHebrew.trim()
  }

  return field.displayName.trim() || humanizeKey(field.key)
}

/** The English and Hebrew names as a form edits them. A Hebrew-only field stores its name in both slots. */
const fieldNames = (field: SchemeField): { en: string; he: string } => ({
  en: field.displayName === field.displayNameHebrew ? '' : field.displayName,
  he: field.displayNameHebrew,
})

/** Write form names back onto a field. */
const withNames = (field: SchemeField, names: { en: string; he: string }): SchemeField => ({
  ...field,
  displayName: names.en.trim() || names.he.trim(),
  displayNameHebrew: names.he.trim(),
})

const emptyField = (): SchemeField => ({
  key: '',
  displayName: '',
  displayNameHebrew: '',
  type: 'string',
  required: false,
  array: false,
  options: [],
  min: null,
  max: null,
  step: null,
  extras: {},
})

/** The first thing keeping a field from being declared, or `null`. */
const fieldProblem = (field: SchemeField, otherKeys: string[]): FieldProblem | null => {
  const key = field.key.trim()
  if (key.length === 0) return 'schemas.problem.keyRequired'
  if (!isValidKey(key)) return 'schemas.problem.keyInvalid'
  if (otherKeys.includes(key)) return 'schemas.problem.keyTaken'
  if (field.displayName.trim().length === 0 && field.displayNameHebrew.trim().length === 0) {
    return 'schemas.problem.nameRequired'
  }
  if (hasOptions(field.type) && field.options.length === 0) return 'schemas.problem.optionsRequired'

  return null
}

const schemeProblems = (fields: SchemeField[]): (FieldProblem | null)[] =>
  fields.map((field, index) =>
    fieldProblem(
      field,
      fields.filter((_, at) => at !== index).map((other) => other.key.trim()),
    ),
  )

const isSchemeValid = (fields: SchemeField[]): boolean => schemeProblems(fields).every((problem) => problem === null)

/** Values of an attribute as typed JSON, used by the create form. */
const castInput = (field: SchemeField, typed: string): JsonValue => {
  if (typed.length === 0) {
    return null
  }
  if (isNumeric(field.type)) {
    const parsed = Number(typed)

    return Number.isNaN(parsed) ? typed : parsed
  }
  if (field.type === 'multi_field') {
    try {
      return JSON.parse(typed) as JsonValue
    } catch {
      return typed
    }
  }

  return typed
}

export type { FieldProblem, FieldType, Language, SchemeField }
export {
  DECLARABLE_TYPES,
  castInput,
  emptyField,
  fieldLabel,
  fieldNames,
  fieldProblem,
  hasOptions,
  isNumeric,
  isSchemeValid,
  mergeFields,
  readField,
  readScheme,
  readType,
  schemeProblems,
  typeLabel,
  withNames,
  writeField,
  writeScheme,
}
