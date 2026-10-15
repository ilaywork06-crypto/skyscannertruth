/**
 * JSON value helpers shared by every layer.
 */

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = Record<string, JsonValue>

/** Whether a value is a plain object (not an array, not null). */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Read a dotted path out of a nested value, or `null` when any step is missing. */
const readPath = (source: unknown, path: string): JsonValue => {
  let current: unknown = source

  for (const part of path.split('.')) {
    if (!isRecord(current)) {
      return null
    }
    current = current[part]
  }

  return current === undefined ? null : (current as JsonValue)
}

/** Render any value as flat, searchable text. */
const toText = (value: JsonValue | undefined): string => {
  if (value === null || value === undefined) {
    return ''
  }
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).join(' ')
  }
  if (typeof value === 'object') {
    return Object.values(value)
      .map((item) => toText(item))
      .join(' ')
  }

  return String(value)
}

/** Whether a value counts as filled in (non-blank string, non-empty list, anything else non-null). */
const isFilled = (value: JsonValue | undefined): boolean => {
  if (value === null || value === undefined) {
    return false
  }
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }

  return true
}

export type { JsonObject, JsonPrimitive, JsonValue }
export { isFilled, isRecord, readPath, toText }
