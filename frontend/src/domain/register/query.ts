/**
 * Searching, filtering, sorting and paging the register in memory.
 *
 * The API offers listings only - no search, filter or ordering - so the whole register is read once and
 * every question is answered here. `RowSource` (see `row-source.ts`) is the seam where a server-side
 * implementation would plug in.
 */

import type { JsonValue } from '../json'
import { readPath, toText } from '../json'
import type { FilterCondition, RegisterPage, RegisterQuery, RegisterRow, SortSpec } from './types'

const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Read a column's values as text, looking under `values.` for declared attributes. */
const readValues = (row: RegisterRow, key: string): string[] => {
  const direct = readPath(row, key)
  const value = direct === null ? readPath(row, `values.${key}`) : direct

  if (value === null) {
    return []
  }
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter((item) => item.length > 0)
  }
  const text = toText(value)

  return text.length > 0 ? [text] : []
}

/** Bookkeeping a reader never sees as text - searching it only produces surprising matches (a uuid). */
const UNSEARCHED: ReadonlySet<string> = new Set(['id', 'schema_ids', 'industry_ids', 'created_at', 'complete', 'archived', 'deleted'])

/** Case-insensitive substring search across every readable value, including attributes not on screen. */
const matchesSearch = (row: RegisterRow, term: string): boolean => {
  const needle = term.trim().toLowerCase()
  if (needle.length === 0) {
    return true
  }

  return Object.entries(row).some(
    ([key, value]) => !UNSEARCHED.has(key) && toText(value as JsonValue).toLowerCase().includes(needle),
  )
}

/** A stored value as the local calendar day it is displayed under. */
const toDay = (text: string): string | null => {
  if (PLAIN_DAY.test(text)) {
    return text
  }
  const moment = new Date(text)
  if (Number.isNaN(moment.getTime())) {
    return null
  }
  const month = String(moment.getMonth() + 1).padStart(2, '0')
  const day = String(moment.getDate()).padStart(2, '0')

  return `${moment.getFullYear()}-${month}-${day}`
}

const isDay = (value: JsonValue | undefined): value is string => typeof value === 'string' && PLAIN_DAY.test(value)

const isDayCondition = (condition: FilterCondition): boolean =>
  condition.operator === 'between' ? isDay(condition.values[0]) : isDay(condition.value)

/** Compare as numbers where both sides are numbers, otherwise as text. */
const compare = (left: string, right: string): number => {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (left.trim() !== '' && right.trim() !== '' && !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)) {
    return Math.sign(leftNumber - rightNumber)
  }

  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

const satisfiesOrdered = (values: string[], condition: FilterCondition): boolean => {
  const asDays = isDayCondition(condition)
  const read = asDays ? values.map(toDay).filter((day): day is string => day !== null) : values
  const bound = toText(condition.value)
  const [low, high] = condition.values.map((value) => toText(value))

  return read.some((value) => {
    switch (condition.operator) {
      case 'equals':
        return compare(value, bound) === 0
      case 'not_equals':
        return compare(value, bound) !== 0
      case 'greater_than':
        return compare(value, bound) > 0
      case 'greater_or_equal':
        return compare(value, bound) >= 0
      case 'less_than':
        return compare(value, bound) < 0
      case 'less_or_equal':
        return compare(value, bound) <= 0
      case 'between':
        return low !== undefined && high !== undefined && compare(value, low) >= 0 && compare(value, high) <= 0
      default:
        return true
    }
  })
}

/** Whether a row satisfies a condition. A multi-valued cell matches when any of its values does. */
const satisfies = (row: RegisterRow, condition: FilterCondition): boolean => {
  const values = readValues(row, condition.key)
  const lowered = values.map((value) => value.toLowerCase())
  const needle = toText(condition.value).toLowerCase()
  const wanted = condition.values.map((value) => toText(value).toLowerCase())

  switch (condition.operator) {
    case 'contains':
      return lowered.some((value) => value.includes(needle))
    case 'not_contains':
      return !lowered.some((value) => value.includes(needle))
    case 'starts_with':
      return lowered.some((value) => value.startsWith(needle))
    case 'ends_with':
      return lowered.some((value) => value.endsWith(needle))
    case 'in':
      return lowered.some((value) => wanted.includes(value))
    case 'not_in':
      return !lowered.some((value) => wanted.includes(value))
    case 'is_empty':
      return values.length === 0
    case 'is_not_empty':
      return values.length > 0
    case 'not_equals':
      return isDayCondition(condition) || !Number.isNaN(Number(needle))
        ? !satisfiesOrdered(values, { ...condition, operator: 'equals' })
        : !lowered.includes(needle)
    case 'equals':
      if (!isDayCondition(condition) && Number.isNaN(Number(needle))) {
        return lowered.includes(needle)
      }

      return satisfiesOrdered(values, condition)
    default:
      return satisfiesOrdered(values, condition)
  }
}

/** Order two rows by one spec; rows missing the value sort last either way. */
const compareBy = (left: RegisterRow, right: RegisterRow, spec: SortSpec): number => {
  const [leftText] = readValues(left, spec.key)
  const [rightText] = readValues(right, spec.key)

  if (leftText === undefined && rightText === undefined) return 0
  if (leftText === undefined) return 1
  if (rightText === undefined) return -1

  const compared = compare(leftText, rightText)

  return spec.direction === 'desc' ? -compared : compared
}

/** Filter, sort and slice rows down to the requested page. */
const runQuery = (rows: RegisterRow[], query: RegisterQuery): RegisterPage => {
  const matched = rows.filter(
    (row) => matchesSearch(row, query.search) && query.filters.every((condition) => satisfies(row, condition)),
  )

  if (query.sort.length > 0) {
    matched.sort((left, right) => {
      for (const spec of query.sort) {
        const compared = compareBy(left, right, spec)
        if (compared !== 0) {
          return compared
        }
      }

      return 0
    })
  }

  const from = Math.max(0, (query.page - 1) * query.pageSize)

  return { rows: matched.slice(from, from + query.pageSize), total: matched.length }
}

/** Every distinct value a column holds, sorted - the vocabulary its set filter offers. */
const collectOptions = (rows: RegisterRow[], key: string): string[] => {
  const seen = new Set<string>()
  rows.forEach((row) => readValues(row, key).forEach((value) => seen.add(value)))

  return [...seen].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
}

/** How many rows hold each value of a column, for quick filter counts. */
const countValues = (rows: RegisterRow[], key: string): Map<string, number> => {
  const counts = new Map<string, number>()
  rows.forEach((row) => new Set(readValues(row, key)).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1)))

  return counts
}

export { collectOptions, countValues, matchesSearch, readValues, runQuery, satisfies, toDay }
