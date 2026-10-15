<script setup lang="ts">
/**
 * The inventory table (spec §4.10): the generated grid with the inventory's own cells, detail rows measured to
 * their content, text that can be selected and copied, sideways scrolling with the wheel (+shift), and a
 * horizontal scrollbar that stays at the bottom of the window while the table is taller than it.
 */
import type { FilterModel, GridApi, SortModelItem } from 'ag-grid-community'
import { EmptyState, translate as t } from '@truth-platform/ui'
import { DataGrid, baseFilters, baseRenderers, type GeneratedGridConfiguration, type GridContext, type GridRow } from '@truth-platform/grid'
import { SearchX } from 'lucide-vue-next'
import { computed, markRaw, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { AUTO_SIZED_COLUMNS } from '@/lib/columns'
import ChipCell from './cells/ChipCell.vue'
import DetailRow from './cells/DetailRow.vue'
import EventLinkCell from './cells/EventLinkCell.vue'
import FilesCell from './cells/FilesCell.vue'
import OpenEventCell from './cells/OpenEventCell.vue'
import ResultCell from './cells/ResultCell.vue'
import StickyScrollBar from './StickyScrollBar.vue'

const props = defineProps<{
  configuration: GeneratedGridConfiguration
  rows: GridRow[]
  context: GridContext
  loading: boolean
  fullscreen: boolean
  findRow: (id: string) => GridRow | undefined
}>()
const emit = defineEmits<{
  ready: [api: GridApi<GridRow>]
  models: [sort: SortModelItem[], filter: FilterModel]
  rowClicked: [row: GridRow, event: Event | null | undefined]
  selection: [ids: string[]]
}>()

const registry = markRaw(baseRenderers({
  ChipCellRenderer: ChipCell,
  EventLinkCellRenderer: EventLinkCell,
  FilesCellRenderer: FilesCell,
  OpenEventCellRenderer: OpenEventCell,
  ResultCellRenderer: ResultCell,
}))
const filters = markRaw(baseFilters())
const detail = markRaw(DetailRow)

const api = shallowRef<GridApi<GridRow> | null>(null)
const host = ref<HTMLElement>()
const viewport = ref<HTMLElement | null>(null)

/* ---------------- detail heights */
const MIN_DETAIL = 264
const MAX_DETAIL = 1400
const measured = new Map<string, number>()
function estimate(parentId: string): number {
  const counts = (props.findRow(parentId)?.entity_counts ?? {}) as Record<string, number>
  const body = Object.values(counts).filter((n) => n > 0).reduce((s, n) => s + 72 + 52 * n, 0)
  return Math.min(MAX_DETAIL, Math.max(MIN_DETAIL, 56 + 96 + body))
}
const detailRowHeight = (parentId: string) => Math.min(MAX_DETAIL, measured.get(parentId) ?? estimate(parentId))
function reportDetailHeight(parentId: string, height: number) {
  const h = Math.min(MAX_DETAIL, Math.ceil(height))
  if (h <= 0 || Math.abs((measured.get(parentId) ?? 0) - h) < 1) return
  measured.set(parentId, h)
  const node = api.value?.getRowNode(`${parentId}::detail`)
  if (node && node.rowHeight !== h) {
    node.setRowHeight(h)
    api.value?.onRowHeightChanged()
  }
}
watch(() => props.rows.map((r) => r.id).join('|'), () => {
  const present = new Set(props.rows.map((r) => String(r.id)))
  for (const k of [...measured.keys()]) if (!present.has(k)) measured.delete(k)
})

const context = computed<GridContext>(() => ({ ...props.context, extra: { ...props.context.extra, reportDetailHeight } }))
watch(context, async (c) => {
  await nextTick()
  if (!api.value || api.value.isDestroyed()) return
  api.value.setGridOption('context', c)
  api.value.refreshCells({ force: true })
})

/* ---------------- sizing */
function autoSize() {
  const a = api.value
  if (!a || a.isDestroyed()) return
  const ids = AUTO_SIZED_COLUMNS.filter((id) => a.getColumn(id)?.isVisible())
  if (ids.length) a.autoSizeColumns(ids, false)
}
function layout() {
  const a = api.value
  if (!a || a.isDestroyed()) return
  a.setGridOption('domLayout', props.fullscreen ? 'normal' : 'autoHeight')
}
watch(() => props.fullscreen, () => {
  layout()
  void nextTick(findViewport)
})

function findViewport() {
  viewport.value = host.value?.querySelector<HTMLElement>('.ag-body-horizontal-scroll-viewport') ?? null
}

function onReady(a: GridApi<GridRow>) {
  api.value = a
  layout()
  a.addEventListener('firstDataRendered', autoSize)
  a.addEventListener('rowDataUpdated', autoSize)
  a.addEventListener('displayedColumnsChanged', () => void nextTick(findViewport))
  void nextTick(findViewport)
  emit('ready', a)
}

/* ---------------- sideways wheel */
function onWheel(e: WheelEvent) {
  const vp = viewport.value
  if (!vp) return
  const horizontal = e.shiftKey ? (e.deltaX || e.deltaY) : Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0
  if (!horizontal) return
  const delta = e.deltaMode === 1 ? horizontal * 16 : horizontal
  const before = vp.scrollLeft
  vp.scrollLeft += delta
  if (vp.scrollLeft !== before) e.preventDefault()
}
onBeforeUnmount(() => {
  api.value = null
})

const empty = computed(() => !props.loading && !props.rows.length)
defineExpose({ api, autoSize })
</script>

<template>
  <div ref="host" :class="['sky-inventory-grid relative', fullscreen ? 'flex min-h-0 flex-1 flex-col' : '']" @wheel="onWheel">
    <div :class="fullscreen ? 'min-h-0 flex-1' : ''">
      <DataGrid
        :configuration="configuration"
        :rows="rows"
        :registry="registry"
        :filters="filters"
        :context="context"
        :loading="loading"
        :detail-component="detail"
        :detail-row-height="detailRowHeight"
        selectable
        @ready="onReady"
        @models="(s, f) => emit('models', s, f)"
        @row-clicked="(r, e) => emit('rowClicked', r, e)"
        @selection="(rows) => emit('selection', rows.map((r) => String(r.id)))"
      />
    </div>
    <EmptyState v-if="empty" compact :title="t('inventory.noMatch')" class="border-t border-border">
      <template #icon><SearchX /></template>
    </EmptyState>
    <StickyScrollBar v-if="!fullscreen" :viewport="viewport" />
  </div>
</template>

<style>
.sky-inventory-grid .ag-overlay-no-rows-wrapper { display: none; }
.sky-inventory-grid .sky-row { cursor: pointer; }
.sky-inventory-grid .sky-row--detail { cursor: default; }
.sky-inventory-grid .ag-cell, .sky-inventory-grid .ag-full-width-row { user-select: text; }
.sky-inventory-grid .sky-cell--stamp, .sky-inventory-grid .sky-header--stamp .ag-header-cell-label { justify-content: flex-end; }
.sky-inventory-grid .ag-selection-checkbox, .sky-inventory-grid [col-id='ag-Grid-SelectionColumn'] { display: flex; align-items: center; }
.sky-row--flash { animation: sky-flash 1600ms ease-out; }
@keyframes sky-flash { 0%, 30% { background-color: rgb(var(--primary-soft)); } 100% { background-color: transparent; } }
.sky-detail { height: 100%; overflow: auto; background: rgb(var(--muted) / 0.35); border-block: 1px solid rgb(var(--border)); }
.sky-link { color: rgb(var(--primary)); font-weight: 500; text-decoration: none; unicode-bidi: plaintext; }
.sky-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.sky-result { display: inline-grid; place-items: center; }
</style>
