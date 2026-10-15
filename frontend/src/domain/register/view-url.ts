/**
 * The table view, encoded into the address so a reload keeps it and a link shares it.
 *
 *   ?q=fuel                                  search
 *   &proposing_party.in=Ops&proposing_party.in=Safety
 *                                            one parameter per condition: <column>.<operator>
 *   &created_at.between=2026-01-01&created_at.between=2026-02-01
 *   &sort=-created_at                        a minus for descending, one per column in order
 *   &page=2&size=50&hide=schemas             page, page size and hidden columns
 *
 * Only what differs from the defaults is written, so an untouched table keeps a bare address. Condition
 * values are always strings, which makes the round trip exact without knowing the columns.
 */

import type { FilterCondition, FilterOperator, SortSpec } from './types'
import { EMPTINESS_OPERATORS, FILTER_OPERATORS, LIST_OPERATORS, sameSort } from './types'

type QueryValue = string | null | (string | null)[]
type AddressQuery = Record<string, QueryValue | undefined>

interface RegisterView {
  search: string
  filters: FilterCondition[]
  sort: SortSpec[]
  page: number
  pageSize: number
  hiddenColumns: string[]
}

type ViewDefaults = Pick<RegisterView, 'sort' | 'pageSize' | 'hiddenColumns'>

const PARAM = { search: 'q', sort: 'sort', page: 'page', size: 'size', hide: 'hide' } as const
const VIEW_PARAMS = new Set<string>(Object.values(PARAM))
const DESCENDING = '-'
const PAGE_SIZES: number[] = [10, 25, 50, 100]
const MAX_PAGE_SIZE = 100
const OPERATORS = new Set<string>(FILTER_OPERATORS)

/** Every value one parameter carries, or `null` when it is absent (an empty parameter is not absent). */
const readParam = (query: AddressQuery, name: string): string[] | null => {
  const raw = query[name]
  if (raw === undefined) {
    return null
  }

  return (Array.isArray(raw) ? raw : [raw]).map((value) => value ?? '')
}

const asParam = (values: string[]): string | string[] => (values.length === 1 ? (values[0] ?? '') : values)

const parseConditionName = (name: string): { key: string; operator: FilterOperator } | null => {
  const dot = name.lastIndexOf('.')
  const operator = name.slice(dot + 1)
  if (dot <= 0 || !OPERATORS.has(operator)) {
    return null
  }

  return { key: name.slice(0, dot), operator: operator as FilterOperator }
}

const readFilters = (query: AddressQuery): FilterCondition[] => {
  const conditions: FilterCondition[] = []

  for (const name of Object.keys(query)) {
    const parsed = parseConditionName(name)
    if (parsed === null) {
      continue
    }
    const { key, operator } = parsed
    const values = readParam(query, name) ?? []

    if (EMPTINESS_OPERATORS.has(operator)) {
      conditions.push({ key, operator, value: null, values: [] })
    } else if (LIST_OPERATORS.has(operator)) {
      const picked = values.filter((value) => value !== '')
      if (picked.length > 0) {
        conditions.push({ key, operator, value: null, values: picked })
      }
    } else if (operator === 'between') {
      for (let index = 0; index + 1 < values.length; index += 2) {
        conditions.push({ key, operator, value: null, values: [values[index] ?? '', values[index + 1] ?? ''] })
      }
    } else {
      values.forEach((value) => conditions.push({ key, operator, value, values: [] }))
    }
  }

  return conditions
}

const writeFilters = (filters: FilterCondition[]): Record<string, string[]> => {
  const params: Record<string, string[]> = {}

  for (const condition of filters) {
    const name = `${condition.key}.${condition.operator}`
    const written = EMPTINESS_OPERATORS.has(condition.operator)
      ? ['']
      : LIST_OPERATORS.has(condition.operator) || condition.operator === 'between'
        ? condition.values.map((value) => String(value ?? ''))
        : [String(condition.value ?? '')]
    params[name] = [...(params[name] ?? []), ...written]
  }

  return params
}

const readSort = (query: AddressQuery, fallback: SortSpec[]): SortSpec[] => {
  const written = readParam(query, PARAM.sort)
  if (written === null) {
    return fallback
  }

  return written
    .filter((text) => text.length > 0 && text !== DESCENDING)
    .map((text) =>
      text.startsWith(DESCENDING)
        ? { key: text.slice(DESCENDING.length), direction: 'desc' as const }
        : { key: text, direction: 'asc' as const },
    )
}

const readCount = (query: AddressQuery, name: string): number | null => {
  const [text] = readParam(query, name) ?? []
  const count = Number(text)

  return text !== undefined && Number.isInteger(count) && count >= 1 ? count : null
}

const sameMembers = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((item) => right.includes(item))

/** Read the view an address names, falling back to the defaults for anything it omits. */
const readView = (query: AddressQuery, defaults: ViewDefaults): RegisterView => {
  const [search] = readParam(query, PARAM.search) ?? ['']
  const size = readCount(query, PARAM.size)
  const hidden = readParam(query, PARAM.hide)

  return {
    search: search ?? '',
    filters: readFilters(query),
    sort: readSort(query, defaults.sort),
    page: readCount(query, PARAM.page) ?? 1,
    pageSize: size !== null && size <= MAX_PAGE_SIZE ? size : defaults.pageSize,
    hiddenColumns: hidden === null ? [...defaults.hiddenColumns] : hidden.filter((id) => id.length > 0),
  }
}

/** Write a view as address parameters, omitting everything equal to the defaults. */
const writeView = (view: RegisterView, defaults: ViewDefaults): Record<string, string | string[]> => {
  const query: Record<string, string | string[]> = {}

  if (view.search.trim().length > 0) {
    query[PARAM.search] = view.search
  }
  for (const [name, values] of Object.entries(writeFilters(view.filters))) {
    query[name] = asParam(values)
  }
  if (!sameSort(view.sort, defaults.sort)) {
    query[PARAM.sort] = asParam(
      view.sort.length === 0 ? [''] : view.sort.map((item) => (item.direction === 'desc' ? `${DESCENDING}${item.key}` : item.key)),
    )
  }
  if (view.page > 1) {
    query[PARAM.page] = String(view.page)
  }
  if (view.pageSize !== defaults.pageSize) {
    query[PARAM.size] = String(view.pageSize)
  }
  if (!sameMembers(view.hiddenColumns, defaults.hiddenColumns)) {
    query[PARAM.hide] = asParam(view.hiddenColumns.length === 0 ? [''] : view.hiddenColumns)
  }

  return query
}

/** Parameters that are not part of the view, which writing the view leaves alone. */
const foreignParams = (query: AddressQuery): AddressQuery =>
  Object.fromEntries(
    Object.entries(query).filter(([name]) => !VIEW_PARAMS.has(name) && parseConditionName(name) === null),
  )

/** Order-independent comparison of two written queries. */
const sameQuery = (left: AddressQuery, right: AddressQuery): boolean => {
  const normal = (query: AddressQuery) =>
    JSON.stringify(
      Object.entries(query)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => [name, Array.isArray(value) ? value : [value]])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    )

  return normal(left) === normal(right)
}

export type { AddressQuery, RegisterView, ViewDefaults }
export { MAX_PAGE_SIZE, PAGE_SIZES, foreignParams, readView, sameQuery, writeView }
