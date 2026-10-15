/**
 * The register's questions answered in the browser: the API has no search, filter, ordering or totals, so the
 * whole register is read and the table's search, conditions, sort and paging run over it here.
 */
import { readPath } from '@truth-platform/ui'
import type { FilterCondition, GridRow, JsonValue, SortSpecification } from '@truth-platform/grid'

const EQUAL = 0
const MISSING_LAST = 1

/** Every value of a value as one text: arrays and object values joined with spaces. */
export function toText(value: JsonValue | undefined): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map(toText).join(' ')
  if (typeof value === 'object') return Object.values(value).map(toText).join(' ')
  return String(value)
}

/** The search covers every value of the row, hidden columns, ids and declared values included. */
export function matchesSearch(row: GridRow, term: string): boolean {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return toText(row as unknown as JsonValue).toLowerCase().includes(needle)
}

/** A row's values under a key: the fixed key first, the declared value (`values.<key>`) when that is empty. */
export function readValues(row: GridRow, key: string): string[] {
  const direct = readPath(row, key) as JsonValue
  const value = direct === null ? (readPath(row, `values.${key}`) as JsonValue) : direct
  if (value === null) return []
  if (Array.isArray(value)) return value.map(toText).filter((v) => v.length > 0)
  const text = toText(value)
  return text.length > 0 ? [text] : []
}

function readNumber(row: GridRow, key: string): number | null {
  const [first] = readValues(row, key)
  if (first === undefined) return null
  const n = Number(first)
  return Number.isNaN(n) ? null : n
}

const conditionText = (c: FilterCondition) => toText(c.value).toLowerCase()

const FILTER_DAY = /^(\d{4}-\d{2}-\d{2})[ T]00:00:00$/
const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/
const DAY_OPERATORS = new Set(['equals', 'not_equals', 'greater_than', 'greater_or_equal', 'less_than', 'less_or_equal', 'between'])

function filterDay(value: JsonValue | undefined): string | null {
  const m = typeof value === 'string' ? FILTER_DAY.exec(value.trim()) : null
  return m ? (m[1] ?? null) : null
}

/** A stored moment as the reader's local calendar day; a plain day is taken as it is. */
export function valueDay(text: string): string | null {
  if (PLAIN_DAY.test(text)) return text
  const d = new Date(text)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function satisfiesDay(values: string[], c: FilterCondition): boolean {
  const days = values.map(valueDay).filter((d): d is string => d !== null)
  const first = filterDay(c.operator === 'between' ? c.values[0] : c.value) ?? ''
  const last = filterDay(c.values[1]) ?? first
  switch (c.operator) {
    case 'equals': return days.includes(first)
    case 'not_equals': return !days.includes(first)
    case 'greater_than': return days.some((d) => d > first)
    case 'greater_or_equal': return days.some((d) => d >= first)
    case 'less_than': return days.some((d) => d < first)
    case 'less_or_equal': return days.some((d) => d <= first)
    default: return days.some((d) => d >= first && d <= last)
  }
}

const isDayCondition = (c: FilterCondition) =>
  DAY_OPERATORS.has(c.operator) && filterDay(c.operator === 'between' ? c.values[0] : c.value) !== null

function satisfiesOrdered(row: GridRow, c: FilterCondition): boolean {
  const n = readNumber(row, c.key)
  const bound = Number(toText(c.value))
  const numeric = n !== null && !Number.isNaN(bound)
  const [text] = readValues(row, c.key)
  if (text === undefined) return false
  const compared = numeric ? Math.sign((n as number) - bound) : text.toLowerCase().localeCompare(conditionText(c))
  switch (c.operator) {
    case 'greater_than': return compared > 0
    case 'greater_or_equal': return compared >= 0
    case 'less_than': return compared < 0
    case 'less_or_equal': return compared <= 0
    case 'between': {
      const [low, high] = c.values.map((v) => Number(toText(v)))
      if (n === null || Number.isNaN(low) || Number.isNaN(high)) return false
      return n >= low && n <= high
    }
    default: return true
  }
}

export function satisfies(row: GridRow, c: FilterCondition): boolean {
  const values = readValues(row, c.key)
  if (isDayCondition(c)) return satisfiesDay(values, c)
  const lowered = values.map((v) => v.toLowerCase())
  const needle = conditionText(c)
  const wanted = c.values.map((v) => toText(v).toLowerCase())
  switch (c.operator) {
    case 'equals': return lowered.includes(needle)
    case 'not_equals': return !lowered.includes(needle)
    case 'contains': return lowered.some((v) => v.includes(needle))
    case 'not_contains': return !lowered.some((v) => v.includes(needle))
    case 'starts_with': return lowered.some((v) => v.startsWith(needle))
    case 'ends_with': return lowered.some((v) => v.endsWith(needle))
    case 'in': return lowered.some((v) => wanted.includes(v))
    case 'not_in': return !lowered.some((v) => wanted.includes(v))
    case 'is_empty': return values.length === 0
    case 'is_not_empty': return values.length > 0
    default: return satisfiesOrdered(row, c)
  }
}

/** Missing values sort last whichever the direction. */
function compareBy(left: GridRow, right: GridRow, spec: SortSpecification): number {
  const [l] = readValues(left, spec.key)
  const [r] = readValues(right, spec.key)
  if (l === undefined && r === undefined) return EQUAL
  if (l === undefined) return MISSING_LAST
  if (r === undefined) return -MISSING_LAST
  const ln = Number(l)
  const rn = Number(r)
  const compared = !Number.isNaN(ln) && !Number.isNaN(rn)
    ? Math.sign(ln - rn)
    : l.localeCompare(r, undefined, { numeric: true, sensitivity: 'base' })
  return spec.direction === 'desc' ? -compared : compared
}

export interface RegisterQuery {
  search: string
  filters: FilterCondition[]
  sort: SortSpecification[]
  page: number
  pageSize: number
}

export function runQuery(rows: GridRow[], q: RegisterQuery): { rows: GridRow[]; total: number; matched: GridRow[] } {
  const matched = rows.filter((row) => matchesSearch(row, q.search) && q.filters.every((c) => satisfies(row, c)))
  if (q.sort.length) {
    matched.sort((a, b) => {
      for (const spec of q.sort) {
        const c = compareBy(a, b, spec)
        if (c !== EQUAL) return c
      }
      return EQUAL
    })
  }
  const from = Math.max(0, (q.page - 1) * q.pageSize)
  return { rows: matched.slice(from, from + q.pageSize), total: matched.length, matched }
}

/** The distinct non-empty values the rows actually hold under a key, sorted case-insensitively. */
export function collectOptions(rows: GridRow[], key: string): string[] {
  const seen = new Set<string>()
  for (const row of rows) for (const v of readValues(row, key)) seen.add(v)
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
