/**
 * AG Grid's filter and sort models <-> the conditions the services understand.
 *
 * Every leaf of a combined AG Grid filter becomes its own condition and the service ANDs them (the wire has no
 * OR); a set filter becomes one `in` condition. Going back - restoring a saved view - a set column gets one set
 * model with every value, and a legacy `equals` on a set column becomes a one-value set.
 */
import type { FilterModel, SortModelItem } from 'ag-grid-community'
import type { FilterCondition, FilterOperator, JsonValue, SortSpecification } from './types'

export const SET_FILTER_TYPE = 'set'
export type AgFilterType = 'text' | 'number' | 'date' | 'set'

const OPERATOR_BY_AG_TYPE: Record<string, FilterOperator> = {
  contains: 'contains',
  notContains: 'not_contains',
  equals: 'equals',
  notEqual: 'not_equals',
  startsWith: 'starts_with',
  endsWith: 'ends_with',
  blank: 'is_empty',
  notBlank: 'is_not_empty',
  empty: 'is_empty',
  greaterThan: 'greater_than',
  greaterThanOrEqual: 'greater_or_equal',
  lessThan: 'less_than',
  lessThanOrEqual: 'less_or_equal',
  inRange: 'between',
}
const AG_TYPE_BY_OPERATOR: Partial<Record<FilterOperator, string>> = Object.fromEntries(
  Object.entries(OPERATOR_BY_AG_TYPE).filter(([ag]) => ag !== 'empty').map(([ag, op]) => [op, ag]),
)

export const AG_TYPE_BY_FILTER_COMPONENT: Record<string, AgFilterType> = {
  agTextColumnFilter: 'text',
  agNumberColumnFilter: 'number',
  agDateColumnFilter: 'date',
  SetColumnFilter: 'set',
}

interface Leaf {
  filterType?: string
  type?: string
  filter?: JsonValue
  filterTo?: JsonValue
  dateFrom?: string | null
  dateTo?: string | null
  values?: JsonValue[]
}

function parseLeaf(key: string, leaf: Leaf): FilterCondition | null {
  if (leaf.values !== undefined) {
    return leaf.values.length ? { key, operator: 'in', value: null, values: [...leaf.values] } : null
  }
  const operator = OPERATOR_BY_AG_TYPE[leaf.type ?? 'contains']
  if (!operator) return null
  const first = leaf.dateFrom ?? leaf.filter ?? null
  const second = leaf.dateTo ?? leaf.filterTo ?? null
  return operator === 'between'
    ? { key, operator, value: null, values: [first, second] }
    : { key, operator, value: first, values: [] }
}

export function buildFilterConditions(model: FilterModel | null | undefined): FilterCondition[] {
  const out: FilterCondition[] = []
  for (const [colId, entry] of Object.entries(model ?? {})) {
    const e = entry as Leaf & { conditions?: Leaf[] }
    const leaves = e.conditions?.length ? e.conditions : [e]
    for (const leaf of leaves) {
      const c = parseLeaf(colId, leaf)
      if (c) out.push(c)
    }
  }
  return out
}

const toDateText = (v: JsonValue): string | null =>
  v === null || v === undefined || typeof v === 'object' ? null : String(v).replace('T', ' ').slice(0, 19)

function buildLeaf(c: FilterCondition, filterType: AgFilterType): Leaf | null {
  if (c.operator === 'in') return c.values.length ? { filterType: SET_FILTER_TYPE, values: c.values.map(String) } : null
  if (filterType === 'set' && c.operator === 'equals' && c.value !== null) return { filterType: SET_FILTER_TYPE, values: [String(c.value)] }
  const type = AG_TYPE_BY_OPERATOR[c.operator]
  if (!type) return null
  if (c.operator === 'is_empty' || c.operator === 'is_not_empty') return { filterType, type }
  const first = c.operator === 'between' ? c.values[0] ?? null : c.value
  const second = c.operator === 'between' ? c.values[1] ?? null : null
  if (filterType === 'date') return { filterType, type, dateFrom: toDateText(first), dateTo: toDateText(second) }
  return c.operator === 'between' ? { filterType, type, filter: first, filterTo: second } : { filterType, type, filter: first }
}

/** Conditions (a saved view) back into a model the grid can be handed. */
export function buildFilterModel(conditions: FilterCondition[], filterComponents: Record<string, string> = {}): FilterModel {
  const grouped = new Map<string, Leaf[]>()
  for (const c of conditions) {
    const filterType: AgFilterType =
      AG_TYPE_BY_FILTER_COMPONENT[filterComponents[c.key] ?? ''] ?? (typeof c.value === 'number' ? 'number' : 'text')
    const leaf = buildLeaf(c, filterType)
    if (!leaf) continue
    grouped.set(c.key, [...(grouped.get(c.key) ?? []), leaf])
  }
  const model: FilterModel = {}
  for (const [key, leaves] of grouped) {
    if (leaves[0].filterType === SET_FILTER_TYPE) {
      model[key] = { filterType: SET_FILTER_TYPE, values: [...new Set(leaves.flatMap((l) => (l.values ?? []).map(String)))] }
    } else if (leaves.length === 1) model[key] = leaves[0]
    else model[key] = { filterType: leaves[0].filterType, operator: 'AND', conditions: leaves }
  }
  return model
}

export function buildSortSpecifications(model: SortModelItem[]): SortSpecification[] {
  return model.map((s) => ({ key: s.colId, direction: s.sort === 'asc' ? 'asc' : 'desc' }))
}

/**
 * A date filter's day as the reader means it: `YYYY-MM-DD 00:00:00` gets the browser's own offset for that
 * day, so the service compares against the reader's local day. Saved views keep unzoned days.
 */
export function withLocalDays(conditions: FilterCondition[]): FilterCondition[] {
  const DAY = /^\d{4}-\d{2}-\d{2}[ T]00:00:00$/
  const zone = (v: JsonValue): JsonValue => {
    if (typeof v !== 'string' || !DAY.test(v)) return v
    const d = new Date(v.replace(' ', 'T'))
    const minutes = -d.getTimezoneOffset()
    const sign = minutes >= 0 ? '+' : '-'
    const abs = Math.abs(minutes)
    return `${v}${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
  }
  return conditions.map((c) => ({ ...c, value: zone(c.value), values: c.values.map(zone) }))
}
