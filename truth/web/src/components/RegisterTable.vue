<script setup lang="ts">
/**
 * The register's AG Grid, built the way the library's DataGrid builds a table (same options, theme, cells and
 * language rebuild), with what a register answered in the browser needs on top:
 *  - the page grows with its rows (`autoHeight`) and a scrollbar pinned to the foot of the window mirrors the
 *    table's horizontal scroll;
 *  - the grid never reorders the page it is handed (the register already sorted it, missing values last);
 *  - its own date filters compare the reader's calendar days and ranges include both ends, like the register;
 *  - panels under rows report their height so each row fits its panel.
 */
import type { ColDef, FilterModel, GridApi, GridOptions, GridReadyEvent, SortModelItem } from 'ag-grid-community'
import { AgGridVue } from 'ag-grid-vue3'
import { translate as t, usePreferences } from '@truth-platform/ui'
import {
  SET_FILTER_TYPE, buildGridOptions, buildGridTheme, isDetailRow, isRowToggleClick, type CellRendererRegistry,
  type FilterComponentRegistry, type GeneratedGridConfiguration, type GridContext, type GridRow,
} from '@truth-platform/grid'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch, type Component } from 'vue'
import { valueDay } from '@/lib/query'

const props = defineProps<{
  configuration: GeneratedGridConfiguration
  rows: GridRow[]
  registry: CellRendererRegistry
  filters: FilterComponentRegistry
  context: GridContext
  visibleColumns: string[]
  detailComponent: Component
  detailRowHeight: (parentId: string) => number
}>()
const emit = defineEmits<{
  models: [sort: SortModelItem[], filter: FilterModel]
  toggle: [rowId: string]
}>()

const prefs = usePreferences()
const rtl = computed(() => prefs.language.value === 'he')
const theme = shallowRef(buildGridTheme(prefs.isDark.value))
watch([prefs.isDark, prefs.accent], async () => {
  await nextTick()
  theme.value = buildGridTheme(prefs.isDark.value)
})

/** The calendar day of a cell against the day picked in the filter (AG Grid hands local midnight). */
function compareDays(filterDate: Date, cell: unknown): number {
  const day = typeof cell === 'string' ? valueDay(cell) : null
  if (day === null) return -1
  const p = (n: number) => String(n).padStart(2, '0')
  const wanted = `${filterDate.getFullYear()}-${p(filterDate.getMonth() + 1)}-${p(filterDate.getDate())}`
  return day < wanted ? -1 : day > wanted ? 1 : 0
}

function adjustColumns(defs: ColDef<GridRow>[]): ColDef<GridRow>[] {
  return defs.map((d) => {
    if (d.filter === 'agDateColumnFilter') return { ...d, filterParams: { ...d.filterParams, comparator: compareDays, inRangeInclusive: true } }
    if (d.filter === 'agNumberColumnFilter') return { ...d, filterParams: { ...d.filterParams, inRangeInclusive: true } }
    return d
  })
}

const options = computed<GridOptions<GridRow>>(() => {
  const base = buildGridOptions({
    configuration: props.configuration,
    registry: props.registry,
    filters: props.filters,
    visibleColumns: props.visibleColumns,
    rtl: rtl.value,
    detailRowHeight: props.detailRowHeight,
    onRowClicked: (row, e) => {
      if (isRowToggleClick(e)) emit('toggle', String(row.id))
    },
  })
  return {
    ...base,
    columnDefs: adjustColumns((base.columnDefs ?? []) as ColDef<GridRow>[]),
    defaultColDef: { ...base.defaultColDef, comparator: () => 0 },
    domLayout: 'autoHeight',
    suppressNoRowsOverlay: true,
    getRowClass: (p) => (isDetailRow(p.data) ? 'sky-row sky-row--detail' : 'sky-row sky-row--toggle'),
  }
})

const localeText = computed(() => ({
  noRowsToShow: t('grid.noRowsToShow'),
  loadingOoo: t('grid.loading'),
  pinColumn: t('grid.pinColumn'),
  pinLeft: t('grid.pinLeft'),
  pinRight: t('grid.pinRight'),
  noPin: t('grid.noPin'),
  autosizeThisColumn: t('grid.autosizeThisColumn'),
  autosizeAllColumns: t('grid.autosizeAllColumns'),
  resetColumns: t('grid.resetColumns'),
  sortAscending: t('grid.sortAscending'),
  sortDescending: t('grid.sortDescending'),
  sortUnSort: t('grid.sortUnSort'),
  columns: t('grid.columns'),
  chooseColumns: t('grid.chooseColumns'),
}))

const api = shallowRef<GridApi<GridRow> | null>(null)
const root = ref<HTMLElement>()
const viewport = shallowRef<HTMLElement | null>(null)
const scrollWidth = ref(0)
const overflow = ref(false)
const bar = ref<HTMLElement>()
let resize: ResizeObserver | null = null

function onReady(e: GridReadyEvent<GridRow>) {
  api.value = e.api
  void nextTick(() => {
    viewport.value = root.value?.querySelector<HTMLElement>('.ag-body-horizontal-scroll-viewport') ?? null
    measure()
  })
}

function measure() {
  const v = viewport.value
  const width = root.value?.clientWidth ?? 0
  const extra = v ? v.scrollWidth - v.clientWidth : 0
  overflow.value = extra > 1
  scrollWidth.value = width + Math.max(0, extra)
}

// The table's own scroll and the pinned bar move together.
let syncing = false
function onBarScroll() {
  if (syncing || !viewport.value || !bar.value) return
  syncing = true
  viewport.value.scrollLeft = bar.value.scrollLeft
  syncing = false
}
watch(viewport, (v, old) => {
  old?.removeEventListener('scroll', onViewportScroll)
  v?.addEventListener('scroll', onViewportScroll, { passive: true })
  resize?.disconnect()
  if (v && typeof ResizeObserver !== 'undefined' && root.value) {
    resize = new ResizeObserver(measure)
    resize.observe(root.value)
  }
})
function onViewportScroll() {
  if (syncing || !viewport.value || !bar.value) return
  syncing = true
  bar.value.scrollLeft = viewport.value.scrollLeft
  syncing = false
}
onBeforeUnmount(() => {
  resize?.disconnect()
  viewport.value?.removeEventListener('scroll', onViewportScroll)
})

function onModels() {
  if (!api.value) return
  const sort = api.value.getColumnState().filter((c) => c.sort).sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
    .map((c) => ({ colId: c.colId, sort: c.sort! }))
  emit('models', sort, api.value.getFilterModel())
}

// Cells read the search term out of the context; repaint them when it changes.
watch(() => props.context.search, () => api.value?.refreshCells({ force: true }))
watch(() => props.rows, () => void nextTick(measure))

defineExpose({
  api,
  setColumnFilterValues(colId: string, values: string[]) {
    if (!api.value) return
    const model = { ...api.value.getFilterModel() }
    if (values.length === 0) delete model[colId]
    else model[colId] = { filterType: SET_FILTER_TYPE, values: [...values] }
    api.value.setFilterModel(model)
  },
  clearColumnFilter(colId: string) {
    void api.value?.setColumnFilterModel(colId, null).then(() => api.value?.onFilterChanged())
  },
  clearFilters() {
    api.value?.setFilterModel(null)
  },
  setColumnVisible(colId: string, visible: boolean) {
    api.value?.setColumnsVisible([colId], visible)
    void nextTick(measure)
  },
  /** A panel's measured height, applied to the row that carries it. */
  fitDetail(parentId: string, height: number) {
    const a = api.value
    if (!a) return
    a.forEachNode((node) => {
      if (isDetailRow(node.data) && String((node.data as GridRow).parentId ?? '') === parentId) node.setRowHeight(height)
    })
    a.onRowHeightChanged()
  },
})
</script>

<template>
  <div ref="root" class="register-table relative min-w-0">
    <AgGridVue
      :key="`${prefs.language.value}:${configuration.version}`"
      class="sky-grid w-full"
      :theme="theme"
      :grid-options="options"
      :row-data="rows"
      :context="context"
      :locale-text="localeText"
      :full-width-cell-renderer="detailComponent"
      @grid-ready="onReady"
      @sort-changed="onModels"
      @filter-changed="onModels"
      @column-resized="measure"
      @displayed-columns-changed="measure"
    />
    <div
      v-show="overflow"
      ref="bar"
      class="register-table__bar sticky bottom-0 z-10 overflow-x-auto overflow-y-hidden border-t border-border bg-card/90 backdrop-blur"
      :dir="rtl ? 'rtl' : 'ltr'"
      aria-hidden="true"
      @scroll="onBarScroll"
    >
      <div :style="{ width: `${scrollWidth}px`, height: '1px' }" />
    </div>
  </div>
</template>

<style>
.register-table .sky-row--toggle { cursor: pointer; }
.register-table .ag-body-horizontal-scroll-viewport { scrollbar-width: none; }
.register-table .ag-body-horizontal-scroll-viewport::-webkit-scrollbar { display: none; }
.register-table .sky-cell--stamp { justify-content: flex-end; }
.register-table .sky-header--end .ag-header-cell-label { justify-content: flex-end; }
.register-table .ag-header-cell-text { text-transform: uppercase; letter-spacing: 0.04em; }
.register-table__bar { height: 14px; }
</style>
