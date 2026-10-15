<script setup lang="ts">
/**
 * One generated table, in the Lattice look. Rebuilt when the language changes (AG Grid reads its direction
 * only when it is built); re-themed when the colour theme changes; filter and sort changes reported upward.
 */
import type { FilterModel, GridApi, GridReadyEvent, SelectionChangedEvent, SortModelItem } from 'ag-grid-community'
import { AgGridVue } from 'ag-grid-vue3'
import { translate as t, usePreferences } from '@truth-platform/ui'
import { computed, nextTick, ref, shallowRef, watch, type Component } from 'vue'
import type { GridContext } from './context'
import { buildGridOptions } from './options'
import type { CellRendererRegistry, FilterComponentRegistry } from './parse'
import { buildGridTheme } from './theme'
import type { GeneratedGridConfiguration, GridRow } from './types'

const props = withDefaults(
  defineProps<{
    configuration: GeneratedGridConfiguration
    rows: GridRow[]
    registry: CellRendererRegistry
    filters?: FilterComponentRegistry
    context: GridContext
    visibleColumns?: string[]
    selectable?: boolean
    loading?: boolean
    /** The full-width component drawn under an expanded row (gets `params.data.parentId`). */
    detailComponent?: Component
    detailRowHeight?: (parentId: string) => number
  }>(),
  { selectable: false, loading: false },
)
const emit = defineEmits<{
  ready: [api: GridApi<GridRow>]
  models: [sort: SortModelItem[], filter: FilterModel]
  rowClicked: [row: GridRow, event: Event | null | undefined]
  selection: [rows: GridRow[]]
}>()

const prefs = usePreferences()
const rtl = computed(() => prefs.language.value === 'he')
const theme = shallowRef(buildGridTheme(prefs.isDark.value))
watch([prefs.isDark, prefs.accent], async () => {
  await nextTick()
  theme.value = buildGridTheme(prefs.isDark.value)
})

const api = ref<GridApi<GridRow> | null>(null)
const options = computed(() =>
  buildGridOptions({
    configuration: props.configuration,
    registry: props.registry,
    filters: props.filters,
    visibleColumns: props.visibleColumns,
    rtl: rtl.value,
    selectable: props.selectable,
    detailRowHeight: props.detailRowHeight,
    onRowClicked: (row, e) => emit('rowClicked', row, e),
  }),
)

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

function onReady(e: GridReadyEvent<GridRow>) {
  api.value = e.api
  emit('ready', e.api)
}
function onModels() {
  if (!api.value) return
  const sort = api.value.getColumnState().filter((c) => c.sort).sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
    .map((c) => ({ colId: c.colId, sort: c.sort! }))
  emit('models', sort, api.value.getFilterModel())
}
function onSelection(e: SelectionChangedEvent<GridRow>) {
  emit('selection', e.api.getSelectedRows())
}
defineExpose({ api })
</script>

<template>
  <AgGridVue
    :key="`${prefs.language.value}:${configuration.version}`"
    class="sky-grid h-full w-full"
    :theme="theme"
    :grid-options="options"
    :row-data="rows"
    :context="context"
    :loading="loading"
    :locale-text="localeText"
    :full-width-cell-renderer="detailComponent"
    @grid-ready="onReady"
    @sort-changed="onModels"
    @filter-changed="onModels"
    @selection-changed="onSelection"
  />
</template>
