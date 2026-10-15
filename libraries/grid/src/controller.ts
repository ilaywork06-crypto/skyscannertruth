/**
 * The state of one generated table: its configuration, the current page of rows, and the search, filters,
 * sort and paging that produce it. Where the rows come from is the caller's business (`loadRows`): the
 * inventory asks the events service for a page, the register answers out of what it already holds.
 */
import type { FilterModel, GridApi, SortModelItem } from 'ag-grid-community'
import { computed, ref, shallowRef } from 'vue'
import { buildFilterConditions, buildSortSpecifications } from './datasource'
import type { FilterCondition, GeneratedGridConfiguration, GridRow, GridRowsPage, SortSpecification } from './types'

export interface RowsQuery {
  search: string | null
  filters: FilterCondition[]
  sort: SortSpecification[]
  page: number
  pageSize: number
}

export interface GridControllerInput {
  loadConfiguration: () => Promise<GeneratedGridConfiguration>
  loadRows: (query: RowsQuery) => Promise<GridRowsPage>
  pageSize?: number
  /** Turns an unknown failure into words. */
  describeError?: (error: unknown, fallback: 'rows' | 'configuration') => string
}

export const DETAIL_ROW_KEY = '__detail'
export const isDetailRow = (row: unknown): boolean => !!row && (row as Record<string, unknown>)[DETAIL_ROW_KEY] === true

export function createGridController(input: GridControllerInput) {
  const configuration = shallowRef<GeneratedGridConfiguration | null>(null)
  const rows = shallowRef<GridRow[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(input.pageSize ?? 25)
  const loading = ref(false)
  const configLoading = ref(false)
  const errorMessage = ref('')
  const search = ref('')
  const expandedIds = ref<string[]>([])
  const filterConditions = shallowRef<FilterCondition[]>([])
  const sortSpecifications = shallowRef<SortSpecification[]>([])
  let gridApi: GridApi<GridRow> | null = null
  let requestSerial = 0

  const pageCount = computed(() => (pageSize.value > 0 ? Math.max(1, Math.ceil(total.value / pageSize.value)) : 1))

  /** The page's rows with a full-width detail row after each expanded one. */
  const displayedRows = computed<GridRow[]>(() => {
    const out: GridRow[] = []
    for (const row of rows.value) {
      out.push(row)
      if (expandedIds.value.includes(String(row.id))) {
        out.push({ id: `${row.id}::detail`, [DETAIL_ROW_KEY]: true, parentId: String(row.id) } as GridRow)
      }
    }
    return out
  })

  const describe = (e: unknown, kind: 'rows' | 'configuration') =>
    input.describeError?.(e, kind) ?? (e instanceof Error && e.message ? e.message : `The ${kind === 'rows' ? 'rows' : 'table'} could not be loaded`)

  function query(): RowsQuery {
    return {
      search: search.value.trim() || null,
      filters: filterConditions.value,
      sort: sortSpecifications.value,
      page: page.value,
      pageSize: pageSize.value,
    }
  }

  async function refreshRows(): Promise<void> {
    const serial = ++requestSerial
    loading.value = true
    errorMessage.value = ''
    try {
      const result = await input.loadRows(query())
      // A slower answer to an older question never overwrites a newer one.
      if (serial !== requestSerial) return
      rows.value = result.rows
      total.value = result.total
      if (page.value > 1 && !result.rows.length && result.total > 0) {
        page.value = Math.max(1, Math.ceil(result.total / pageSize.value))
        return refreshRows()
      }
    } catch (e) {
      if (serial !== requestSerial) return
      errorMessage.value = describe(e, 'rows')
      rows.value = []
      total.value = 0
    } finally {
      if (serial === requestSerial) loading.value = false
    }
  }

  async function refreshConfiguration(): Promise<void> {
    configLoading.value = true
    errorMessage.value = ''
    try {
      configuration.value = await input.loadConfiguration()
      if (!sortSpecifications.value.length) sortSpecifications.value = configuration.value.defaultSort
    } catch (e) {
      errorMessage.value = describe(e, 'configuration')
    } finally {
      configLoading.value = false
    }
  }

  /** What the grid's own headers say now; a change starts again at page one. */
  function applyGridModels(sortModel: SortModelItem[], filterModel: FilterModel | null): void {
    const sort = sortModel.length ? buildSortSpecifications(sortModel) : (configuration.value?.defaultSort ?? [])
    const filters = buildFilterConditions(filterModel)
    if (JSON.stringify(sort) === JSON.stringify(sortSpecifications.value) && JSON.stringify(filters) === JSON.stringify(filterConditions.value)) return
    sortSpecifications.value = sort
    filterConditions.value = filters
    page.value = 1
    void refreshRows()
  }

  function setSearch(value: string): void {
    if (value === search.value) return
    search.value = value
    page.value = 1
    void refreshRows()
  }

  function toggleExpanded(id: string): void {
    const key = String(id)
    expandedIds.value = expandedIds.value.includes(key) ? expandedIds.value.filter((x) => x !== key) : [...expandedIds.value, key]
  }

  return {
    configuration,
    rows,
    displayedRows,
    total,
    page,
    pageSize,
    pageCount,
    loading,
    configLoading,
    errorMessage,
    search,
    expandedIds,
    filterConditions,
    sortSpecifications,
    refreshRows,
    refreshConfiguration,
    applyGridModels,
    setSearch,
    toggleExpanded,
    collapseAll: () => (expandedIds.value = []),
    goToPage(n: number) {
      page.value = Math.min(Math.max(1, n), pageCount.value)
      void refreshRows()
    },
    setPageSize(n: number) {
      pageSize.value = n
      page.value = 1
      void refreshRows()
    },
    setGridApi(api: GridApi<GridRow> | null) {
      gridApi = api
    },
    gridApi: () => gridApi,
  }
}

export type GridController = ReturnType<typeof createGridController>
