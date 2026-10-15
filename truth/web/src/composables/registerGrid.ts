/**
 * The register's table bound to the register: the rows of one industry, a configuration built from that
 * industry's fields, and the grid controller answering every question out of the rows already held.
 */
import { usePreferences } from '@truth-platform/ui'
import {
  createGridController, type FilterCondition, type FilterOption, type GeneratedColumn, type GeneratedGridConfiguration,
  type GridRow, type GridRowsPage,
} from '@truth-platform/grid'
import { computed, onScopeDispose, shallowRef, watch, type ComputedRef, type Ref } from 'vue'
import type { AssumptionRow } from '@/models'
import { buildConfiguration, fieldsSignature } from '@/lib/columns'
import { collectOptions, runQuery } from '@/lib/query'
import { assumptionToRow } from '@/lib/rows'
import type { SchemeField } from '@/lib/scheme'

export const DEFAULT_PAGE_SIZE = 25
const REFRESH_DELAY_MS = 150

/** What the table is narrowed by, published for the panels under its rows (mounted outside the app tree). */
export const activeFilters = shallowRef<FilterCondition[]>([])
export const narrowedValues = (colId: string): string[] =>
  activeFilters.value.filter((c) => c.key === colId).flatMap((c) => c.values.map(String))

/**
 * The values a set filter offers, per column, drawn from the rows actually held (not from declared options) and
 * kept live as readings land - the filter component reads this rather than the options the grid was built with.
 */
export const liveFilterOptions = shallowRef<Record<string, FilterOption[]>>({})

export function useRegisterGrid(input: { assumptions: Ref<AssumptionRow[]>; fields: ComputedRef<SchemeField[]>; industry: ComputedRef<string> }) {
  const { language } = usePreferences()
  const rows = computed<GridRow[]>(() => input.assumptions.value.map(assumptionToRow))
  /** A row shows only once its reading has landed, matched to the industry by name or id. */
  const scoped = computed<GridRow[]>(() => {
    const industry = input.industry.value
    return rows.value.filter((row) => {
      const names = row.industries
      const ids = row.industry_ids
      return (Array.isArray(names) && names.includes(industry)) || (Array.isArray(ids) && ids.includes(industry))
    })
  })

  /** Rebuilt (resetting the arrangement and sort) only when the language or the fields' key:type change. */
  const baseConfiguration = shallowRef<GeneratedGridConfiguration>(buildConfiguration(input.fields.value, language.value))
  watch(
    () => `${language.value}|${fieldsSignature(input.fields.value)}`,
    () => {
      baseConfiguration.value = buildConfiguration(input.fields.value, language.value)
      void controller.refreshConfiguration()
    },
  )

  const options = computed<Record<string, FilterOption[]>>(() => {
    const out: Record<string, FilterOption[]> = {}
    for (const c of baseConfiguration.value.columns) {
      if (c.filter === 'SetColumnFilter') out[c.colId] = collectOptions(scoped.value, c.colId).map((value) => ({ value, label: value }))
    }
    return out
  })
  watch(options, (o) => (liveFilterOptions.value = o), { immediate: true })

  /** The columns with their live options, for the quick filters, the chips and the column picker. */
  const columns = computed<GeneratedColumn[]>(() =>
    baseConfiguration.value.columns.map((c) => (options.value[c.colId] ? { ...c, filterOptions: options.value[c.colId] } : c)),
  )

  const controller = createGridController({
    pageSize: DEFAULT_PAGE_SIZE,
    loadConfiguration: () => Promise.resolve({ ...baseConfiguration.value, columns: columns.value }),
    loadRows: (q): Promise<GridRowsPage> => {
      const answer = runQuery(scoped.value, { search: q.search ?? '', filters: q.filters, sort: q.sort, page: q.page, pageSize: q.pageSize })
      return Promise.resolve({
        rows: answer.rows,
        total: answer.total,
        page: q.page,
        pageSize: q.pageSize,
        pages: Math.max(1, Math.ceil(answer.total / q.pageSize)),
      })
    },
  })

  watch(controller.filterConditions, (c) => (activeFilters.value = c), { immediate: true })

  let pending: ReturnType<typeof setTimeout> | null = null
  watch(scoped, () => {
    if (pending !== null) clearTimeout(pending)
    pending = setTimeout(() => {
      pending = null
      void controller.refreshRows()
    }, REFRESH_DELAY_MS)
  })
  onScopeDispose(() => {
    if (pending !== null) clearTimeout(pending)
    activeFilters.value = []
  })

  return { controller, rows, scoped, columns }
}
