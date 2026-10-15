/**
 * The vocabulary of the register table: rows, columns, filters, sorting and pages.
 */

import type { JsonValue } from '../json'

/** A flattened assumption, as the table addresses it. */
interface RegisterRow {
  id: string
  name: string
  assumption_text: string
  proposing_party: string
  tags: string[]
  validation_responsible_parties: string[]
  revision: number
  creator: string
  created_at: string
  schemas: string[]
  schema_ids: string[]
  industries: string[]
  industry_ids: string[]
  revision_reason: string
  archived: boolean
  deleted: boolean
  /** Whether the assumption's detail has been read (values and industries are present). */
  complete: boolean
  values: Record<string, JsonValue>
}

/** How a cell paints its value. */
type CellKind = 'longtext' | 'text' | 'chip' | 'chips' | 'number' | 'date' | 'datetime' | 'boolean' | 'json'

/** How a column is narrowed. `set` picks from the values the rows hold. */
type FilterKind = 'set' | 'text' | 'number' | 'date'

/** How chips in a column are coloured. */
type ChipPalette = 'hashed' | 'neutral'

interface ColumnDef {
  id: string
  /** Dotted path into the row. */
  field: string
  label: string
  cell: CellKind
  filter: FilterKind
  palette: ChipPalette
  /** Width in px; the column grows from there. */
  width: number
  sortable: boolean
  /** Offered as a one-click quick filter above the table. */
  quick: boolean
  /** Declared by a schema rather than by the API. */
  dynamic: boolean
  /** Held at the start of the row while the rest scrolls. */
  pinned: boolean
}

type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_or_equal'
  | 'less_than'
  | 'less_or_equal'
  | 'in'
  | 'not_in'
  | 'between'
  | 'is_empty'
  | 'is_not_empty'

/**
 * One condition. `value` holds a single operand; `values` holds a list (`in`) or a range (`between`).
 * Dates are written as plain `YYYY-MM-DD` days.
 */
interface FilterCondition {
  key: string
  operator: FilterOperator
  value: JsonValue
  values: JsonValue[]
}

interface SortSpec {
  key: string
  direction: 'asc' | 'desc'
}

interface RegisterQuery {
  search: string
  filters: FilterCondition[]
  sort: SortSpec[]
  page: number
  pageSize: number
}

interface RegisterPage {
  rows: RegisterRow[]
  total: number
}

const FILTER_OPERATORS: readonly FilterOperator[] = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'greater_or_equal',
  'less_than',
  'less_or_equal',
  'in',
  'not_in',
  'between',
  'is_empty',
  'is_not_empty',
]

/** Operators that take a list of values. */
const LIST_OPERATORS: ReadonlySet<FilterOperator> = new Set(['in', 'not_in'])
/** Operators that take no value. */
const EMPTINESS_OPERATORS: ReadonlySet<FilterOperator> = new Set(['is_empty', 'is_not_empty'])

/** Which operators each kind of filter offers, in menu order. */
const OPERATORS_BY_FILTER: Record<FilterKind, FilterOperator[]> = {
  set: ['in', 'not_in', 'is_empty', 'is_not_empty'],
  text: ['contains', 'not_contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
  number: ['equals', 'not_equals', 'greater_than', 'greater_or_equal', 'less_than', 'less_or_equal', 'between', 'is_empty', 'is_not_empty'],
  date: ['equals', 'greater_than', 'less_than', 'between', 'is_empty', 'is_not_empty'],
}

const sameSort = (left: SortSpec[], right: SortSpec[]): boolean =>
  left.length === right.length &&
  left.every((item, index) => item.key === right[index]?.key && item.direction === right[index]?.direction)

export type {
  CellKind,
  ChipPalette,
  ColumnDef,
  FilterCondition,
  FilterKind,
  FilterOperator,
  RegisterPage,
  RegisterQuery,
  RegisterRow,
  SortSpec,
}
export { EMPTINESS_OPERATORS, FILTER_OPERATORS, LIST_OPERATORS, OPERATORS_BY_FILTER, sameSort }
