/**
 * The state of one industry's register table - search, filters, sort, paging, column visibility and expanded
 * rows - and the page of rows it currently shows.
 *
 * Every page is read through a `RowSource`, so moving the query to the service later only swaps the source.
 */

import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'

import { DEFAULT_HIDDEN_COLUMNS, DEFAULT_SORT, buildColumns } from '@/domain/register/columns'
import { countValues } from '@/domain/register/query'
import { createMemoryRowSource } from '@/domain/register/row-source'
import { rowInIndustry, toRegisterRow } from '@/domain/register/rows'
import type { ColumnDef, FilterCondition, RegisterPage, RegisterQuery, RegisterRow, SortSpec } from '@/domain/register/types'
import type { RegisterView, ViewDefaults } from '@/domain/register/view-url'
import { useI18n } from '@/i18n'
import { useRegisterStore } from '@/stores/register'

const DEFAULT_PAGE_SIZE = 25

/** Arrivals of assumption details come in bursts; this collapses each burst into one refresh. */
const ROWS_SETTLE_MS = 120

const VIEW_DEFAULTS: ViewDefaults = {
  sort: DEFAULT_SORT,
  pageSize: DEFAULT_PAGE_SIZE,
  hiddenColumns: [...DEFAULT_HIDDEN_COLUMNS],
}

interface QuickFilterOption {
  value: string
  count: number
}

const useRegisterTable = (industryId: Ref<string>) => {
  const register = useRegisterStore()
  const { t, language } = useI18n()

  /* ---------- data ---------- */

  const rows = computed<RegisterRow[]>(() =>
    register.assumptions.map(toRegisterRow).filter((row) => rowInIndustry(row, industryId.value)),
  )
  const fields = computed(() => register.fieldsFor([industryId.value]))
  const columns = computed<ColumnDef[]>(() => buildColumns(fields.value, t, language.value))
  const source = createMemoryRowSource(() => rows.value)

  /* ---------- view state ---------- */

  const search = ref('')
  const filters = shallowRef<FilterCondition[]>([])
  const sort = shallowRef<SortSpec[]>([...DEFAULT_SORT])
  const page = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const hiddenColumns = ref<string[]>([...DEFAULT_HIDDEN_COLUMNS])
  const expanded = ref<Set<string>>(new Set())

  const visibleColumns = computed(() => columns.value.filter((column) => !hiddenColumns.value.includes(column.id)))
  const quickColumns = computed(() => columns.value.filter((column) => column.quick))

  const query = computed<RegisterQuery>(() => ({
    search: search.value,
    filters: filters.value,
    sort: sort.value,
    page: page.value,
    pageSize: pageSize.value,
  }))

  /* ---------- the current page ---------- */

  const result = shallowRef<RegisterPage>({ rows: [], total: 0 })
  const pageCount = computed(() => Math.max(1, Math.ceil(result.value.total / pageSize.value)))
  let ticket = 0

  const refresh = async (): Promise<void> => {
    ticket += 1
    const mine = ticket
    const answer = await source.readPage(query.value)
    if (mine === ticket) {
      result.value = answer
    }
  }

  watch(query, () => void refresh(), { immediate: true })

  let settleTimer: ReturnType<typeof setTimeout> | null = null
  watch(rows, () => {
    if (settleTimer !== null) clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      settleTimer = null
      void refresh()
    }, ROWS_SETTLE_MS)
  })
  onScopeDispose(() => {
    if (settleTimer !== null) clearTimeout(settleTimer)
  })

  /* A narrowing that leaves fewer pages than the one being read moves back to the last one. */
  watch(pageCount, (count) => {
    if (page.value > count && !register.completing) {
      page.value = count
    }
  })

  /* ---------- actions ---------- */

  const setSearch = (term: string) => {
    search.value = term
    page.value = 1
  }

  const setFilters = (next: FilterCondition[]) => {
    filters.value = next
    page.value = 1
  }

  /** Replace every condition on one column (null removes them). */
  const setColumnFilter = (key: string, condition: FilterCondition | null) =>
    setFilters([...filters.value.filter((item) => item.key !== key), ...(condition === null ? [] : [condition])])

  /** Narrow a column to a set of values (empty clears it). */
  const setColumnValues = (key: string, values: string[]) =>
    setColumnFilter(key, values.length === 0 ? null : { key, operator: 'in', value: null, values })

  const valuesFor = (key: string): string[] =>
    filters.value
      .filter((condition) => condition.key === key && condition.operator === 'in')
      .flatMap((condition) => condition.values.map(String))

  const removeFilter = (index: number) => setFilters(filters.value.filter((_, at) => at !== index))

  const clearAll = () => {
    search.value = ''
    setFilters([])
  }

  /** Cycle a column asc → desc → off. `additive` (Shift+click) keeps the other columns' sort. */
  const toggleSort = (key: string, additive: boolean) => {
    const held = sort.value.find((item) => item.key === key)
    const next: SortSpec | null =
      held === undefined ? { key, direction: 'asc' } : held.direction === 'asc' ? { key, direction: 'desc' } : null

    if (!additive) {
      sort.value = next === null ? [] : [next]
    } else if (next === null) {
      sort.value = sort.value.filter((item) => item.key !== key)
    } else if (held === undefined) {
      sort.value = [...sort.value, next]
    } else {
      sort.value = sort.value.map((item) => (item.key === key ? next : item))
    }
  }

  const setPage = (next: number) => {
    page.value = Math.min(Math.max(1, next), pageCount.value)
  }

  const setPageSize = (size: number) => {
    pageSize.value = size
    page.value = 1
  }

  const toggleColumn = (id: string, visible: boolean) => {
    hiddenColumns.value = visible ? hiddenColumns.value.filter((item) => item !== id) : [...hiddenColumns.value, id]
  }

  const resetColumns = () => {
    hiddenColumns.value = [...DEFAULT_HIDDEN_COLUMNS]
  }

  const toggleExpanded = (rowId: string) => {
    const next = new Set(expanded.value)
    if (next.has(rowId)) {
      next.delete(rowId)
    } else {
      next.add(rowId)
    }
    expanded.value = next
  }

  const quickOptions = (key: string): QuickFilterOption[] =>
    [...countValues(rows.value, key).entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))

  /* ---------- the view as a whole (for the address) ---------- */

  const view = computed<RegisterView>(() => ({
    search: search.value,
    filters: filters.value,
    sort: sort.value,
    page: page.value,
    pageSize: pageSize.value,
    hiddenColumns: hiddenColumns.value,
  }))

  const applyView = (next: RegisterView) => {
    search.value = next.search
    filters.value = next.filters
    sort.value = next.sort
    pageSize.value = next.pageSize
    page.value = next.page
    hiddenColumns.value = next.hiddenColumns
  }

  const isNarrowed = computed(() => search.value.trim().length > 0 || filters.value.length > 0)

  return {
    rows,
    fields,
    columns,
    visibleColumns,
    quickColumns,
    source,
    search,
    filters,
    sort,
    page,
    pageSize,
    pageCount,
    hiddenColumns,
    expanded,
    result,
    isNarrowed,
    view,
    viewDefaults: VIEW_DEFAULTS,
    setSearch,
    setFilters,
    setColumnFilter,
    setColumnValues,
    valuesFor,
    removeFilter,
    clearAll,
    toggleSort,
    setPage,
    setPageSize,
    toggleColumn,
    resetColumns,
    toggleExpanded,
    quickOptions,
    applyView,
  }
}

type RegisterTable = ReturnType<typeof useRegisterTable>

export type { QuickFilterOption, RegisterTable }
export { DEFAULT_PAGE_SIZE, useRegisterTable }
