/**
 * Searching, filtering, sorting and paging the register in the browser.
 *
 * The API offers one window onto each collection and nothing else: no search, no filter, no ordering. The
 * whole register is therefore read once and every question asked of it is answered here, against the rows
 * already in memory. That is what lets the table keep the filters, the search and the ordering it was
 * designed with, and it is why the loader reads the collection whole rather than a page at a time.
 */

import type { FilterCondition, GridRow, JsonValue, SortSpecification } from '@truth-platform/core-ui'
import { readPath } from '@truth-platform/core-ui'

/** What a comparison answers when neither value can be ordered against the other. */
const EQUAL = 0

/** A row missing the value being ordered by sorts after every row that has one, in either direction. */
const MISSING_LAST = 1

/**
 * Render one value as the text a search is matched against.
 */
const toText = (value: JsonValue): string => {
  if (value === null) {
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

/**
 * Answer whether a row matches a free text search, which is asked of every value the row carries.
 *
 * The search is matched as a case insensitive substring anywhere in the row, so a term is found in an
 * attribute the table is not even showing - which is what a reader expects of a search box over a register
 * whose columns change with its schemas.
 */
const matchesSearch = (row: GridRow, term: string): boolean => {
  const needle = term.trim().toLowerCase()
  if (needle.length === 0) {
    return true
  }

  return toText(row as JsonValue).toLowerCase().includes(needle)
}

/**
 * Render the value a filter is tested against, as the list of readings that value has.
 *
 * A cell holding several values - the industries of an assumption, its tags - is matched when any one of them
 * matches, so a filter on "Telemetry" finds every assumption that names it among others.
 */
const readValues = (row: GridRow, key: string): string[] => {
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

/**
 * Read the one number a numeric comparison is made against, or nothing when the value is not a number.
 */
const readNumber = (row: GridRow, key: string): number | null => {
  const [first] = readValues(row, key)
  if (first === undefined) {
    return null
  }

  const parsed = Number(first)

  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Render the value of a filter condition as the text its own comparison is made against.
 */
const conditionText = (condition: FilterCondition): string => toText(condition.value).toLowerCase()

/** A day exactly as a date filter writes it: midnight and nothing else. */
const FILTER_DAY = /^(\d{4}-\d{2}-\d{2})[ T]00:00:00$/

/** A value that is a calendar day and not a moment, which is the same day wherever it is read. */
const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/

/** The operators a day can be compared with, as opposed to the ones that ask about text or emptiness. */
const DAY_OPERATORS: ReadonlySet<string> = new Set([
  'equals',
  'not_equals',
  'greater_than',
  'greater_or_equal',
  'less_than',
  'less_or_equal',
  'between',
])

/** Read the day a date filter sent, or nothing when the value is not one. */
const filterDay = (value: JsonValue | undefined): string | null => {
  const match = typeof value === 'string' ? FILTER_DAY.exec(value.trim()) : null

  return match === null ? null : (match[1] ?? null)
}

/**
 * Read a stored value as the calendar day the table shows it under.
 *
 * A moment belongs to the day it falls on in the reader's zone, because that is the day it is displayed
 * under; a plain date is its own day.
 */
const valueDay = (text: string): string | null => {
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

/**
 * Answer whether a row satisfies a condition over whole days.
 *
 * A date filter sends a day as a midnight, and a stored moment is never that exact text, so comparing the two
 * as text or as numbers found nothing - or, for "after", the very day that was picked. Both sides are read as
 * calendar days instead, and a range holds both of its ends, the way the inventory's own date filter does.
 */
const satisfiesDay = (values: string[], condition: FilterCondition): boolean => {
  const days = values.map(valueDay).filter((day): day is string => day !== null)
  const first = filterDay(condition.operator === 'between' ? condition.values[0] : condition.value) ?? ''
  const last = filterDay(condition.values[1]) ?? first

  switch (condition.operator) {
    case 'equals':
      return days.includes(first)
    case 'not_equals':
      return !days.includes(first)
    case 'greater_than':
      return days.some((day) => day > first)
    case 'greater_or_equal':
      return days.some((day) => day >= first)
    case 'less_than':
      return days.some((day) => day < first)
    case 'less_or_equal':
      return days.some((day) => day <= first)
    default:
      return days.some((day) => day >= first && day <= last)
  }
}

/** Whether a condition compares whole days, which is decided by the value the filter sent. */
const isDayCondition = (condition: FilterCondition): boolean =>
  DAY_OPERATORS.has(condition.operator)
  && filterDay(condition.operator === 'between' ? condition.values[0] : condition.value) !== null

/**
 * Answer whether one row satisfies one condition.
 *
 * Everything is compared case insensitively, and every comparison over a cell of several values is satisfied
 * by any one of them - except the two that ask about emptiness, which are about the cell as a whole.
 */
const satisfies = (row: GridRow, condition: FilterCondition): boolean => {
  const values = readValues(row, condition.key)
  const lowered = values.map((value) => value.toLowerCase())
  const needle = conditionText(condition)
  const wanted = condition.values.map((value) => toText(value).toLowerCase())

  if (isDayCondition(condition)) {
    return satisfiesDay(values, condition)
  }

  switch (condition.operator) {
    case 'equals':
      return lowered.includes(needle)
    case 'not_equals':
      return !lowered.includes(needle)
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
    default:
      return satisfiesOrdered(row, condition)
  }
}

/**
 * Answer whether one row satisfies a comparison of magnitude, over numbers where it can and over text where
 * it cannot - which is what lets the same condition narrow a count and a date alike.
 */
const satisfiesOrdered = (row: GridRow, condition: FilterCondition): boolean => {
  const number = readNumber(row, condition.key)
  const bound = Number(toText(condition.value))
  const numeric = number !== null && !Number.isNaN(bound)
  const [text] = readValues(row, condition.key)
  const needle = conditionText(condition)

  if (text === undefined) {
    return false
  }

  const compared = numeric ? Math.sign(number - bound) : text.toLowerCase().localeCompare(needle)

  switch (condition.operator) {
    case 'greater_than':
      return compared > 0
    case 'greater_or_equal':
      return compared >= 0
    case 'less_than':
      return compared < 0
    case 'less_or_equal':
      return compared <= 0
    case 'between': {
      const [low, high] = condition.values.map((value) => Number(toText(value)))
      if (number === null || Number.isNaN(low) || Number.isNaN(high)) {
        return false
      }

      return number >= low && number <= high
    }
    default:
      return true
  }
}

/**
 * Order two rows by one specification, keeping rows that carry nothing at the end whichever way it points.
 */
const compareBy = (left: GridRow, right: GridRow, specification: SortSpecification): number => {
  const [leftText] = readValues(left, specification.key)
  const [rightText] = readValues(right, specification.key)

  if (leftText === undefined && rightText === undefined) {
    return EQUAL
  }
  if (leftText === undefined) {
    return MISSING_LAST
  }
  if (rightText === undefined) {
    return -MISSING_LAST
  }

  const leftNumber = Number(leftText)
  const rightNumber = Number(rightText)
  const numeric = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber)
  const compared = numeric
    ? Math.sign(leftNumber - rightNumber)
    : leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: 'base' })

  return specification.direction === 'desc' ? -compared : compared
}

/** What a caller asks the register for. */
interface RegisterQuery {
  search: string
  filters: FilterCondition[]
  sort: SortSpecification[]
  page: number
  pageSize: number
}

/** One page of the answer, together with how many rows the whole answer holds. */
interface RegisterPage {
  rows: GridRow[]
  total: number
}

/**
 * Narrow, order and cut the register down to the page a table is asking for.
 */
const runQuery = (rows: GridRow[], query: RegisterQuery): RegisterPage => {
  const matched = rows.filter(
    (row) => matchesSearch(row, query.search) && query.filters.every((condition) => satisfies(row, condition)),
  )

  if (query.sort.length > 0) {
    /* The rows are copied before being ordered, so that the register itself keeps the order it was read in. */
    matched.sort((left, right) => {
      for (const specification of query.sort) {
        const compared = compareBy(left, right, specification)
        if (compared !== EQUAL) {
          return compared
        }
      }

      return EQUAL
    })
  }

  const from = Math.max(0, (query.page - 1) * query.pageSize)

  return { rows: matched.slice(from, from + query.pageSize), total: matched.length }
}

/**
 * Read every value one column is known to hold, which is the vocabulary its filter offers to pick from.
 */
const collectOptions = (rows: GridRow[], key: string): string[] => {
  const seen = new Set<string>()
  rows.forEach((row) => readValues(row, key).forEach((value) => seen.add(value)))

  return [...seen].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
}

export type { RegisterPage, RegisterQuery }
export { collectOptions, matchesSearch, readValues, runQuery, satisfies, toText }
