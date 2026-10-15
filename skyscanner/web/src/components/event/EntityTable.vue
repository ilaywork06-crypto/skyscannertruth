<script setup lang="ts">
/**
 * The entities of one type (spec §6.5): the generated entity columns that are not metadata, resizable; a row
 * opens its own metadata underneath; rows can be ticked to download their files together; each row downloads
 * its own archive or opens for editing.
 */
import { Download, FolderArchive, History, Pencil, X } from 'lucide-vue-next'
import { Button, Checkbox, EMPTY_PLACEHOLDER, Tooltip, translate as t, usePreferences, valueText, readPath } from '@truth-platform/ui'
import { isRowToggleClick, type GeneratedColumn, type TaxonomyItem } from '@truth-platform/grid'
import { computed, ref, watch } from 'vue'
import type { Artifact } from '@/api/artifacts'
import { entityToRow, type EntityResponse } from '@/api/events'
import { attributeColumns, readArtifacts } from '@/lib/events'
import AttributesTable from './AttributesTable.vue'
import DynamicCell from './DynamicCell.vue'

const props = withDefaults(
  defineProps<{ columns: GeneratedColumn[]; entities: EntityResponse[]; taxonomy?: TaxonomyItem[]; downloading?: boolean; showHistory?: boolean }>(),
  { taxonomy: () => [], downloading: false, showHistory: false },
)
const emit = defineEmits<{
  open: [artifact: Artifact]
  download: [artifact: Artifact]
  edit: [entity: EntityResponse]
  history: [entity: EntityResponse]
  archive: [entities: EntityResponse[]]
}>()
const { direction } = usePreferences()
const rtl = computed(() => direction.value === 'rtl')

const shown = computed(() => props.columns.filter((c) => !c.hide && !c.dynamic && c.colId !== 'expander'))
const rows = computed(() => props.entities.map((e) => ({ entity: e, row: entityToRow(e) })))

/* ---------------- sizing */
const REM = 16
const widths = ref<Record<string, number> | null>(null)
watch(() => shown.value.map((c) => c.colId).join('|'), () => (widths.value = null))

function cellStyle(c: GeneratedColumn): Record<string, string> {
  const px = widths.value?.[c.colId]
  if (px !== undefined) return { flex: `0 0 ${px / REM}rem`, minWidth: `${px / REM}rem` }
  if (c.flex === null) {
    const w = (c.width ?? 64) / REM
    return { flex: `0 0 ${w}rem`, minWidth: `${w}rem` }
  }
  const basis = (c.minWidth ?? 96) / REM
  return { flex: `${c.flex} 1 ${basis}rem`, minWidth: `${basis * 0.75}rem` }
}

const header = ref<HTMLElement>()
function startResize(e: PointerEvent, colId: string) {
  e.preventDefault()
  e.stopPropagation()
  if (!widths.value && header.value) {
    const frozen: Record<string, number> = {}
    header.value.querySelectorAll<HTMLElement>('[data-col]').forEach((el) => (frozen[el.dataset.col!] = el.getBoundingClientRect().width))
    widths.value = frozen
  }
  const start = e.clientX
  const initial = widths.value?.[colId] ?? 96
  const move = (ev: PointerEvent) => {
    const delta = (ev.clientX - start) * (rtl.value ? -1 : 1)
    widths.value = { ...(widths.value ?? {}), [colId]: Math.max(48, initial + delta) }
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

/* ---------------- selection */
const selected = ref<string[]>([])
watch(() => props.entities.map((e) => e.id), (ids) => (selected.value = selected.value.filter((id) => ids.includes(id))))
const allState = computed<boolean | 'indeterminate'>(() =>
  !selected.value.length ? false : selected.value.length === props.entities.length ? true : 'indeterminate',
)
function toggleAll(v: boolean | 'indeterminate') {
  selected.value = v === true ? props.entities.map((e) => e.id) : []
}
function toggleOne(id: string, v: boolean | 'indeterminate') {
  selected.value = v === true ? [...new Set([...selected.value, id])] : selected.value.filter((x) => x !== id)
}
const selectedEntities = computed(() => props.entities.filter((e) => selected.value.includes(e.id)))

/* ---------------- inline detail */
const openIds = ref<string[]>([])
function onRowClick(e: MouseEvent, id: string) {
  if ((e.target as Element | null)?.closest('a, button, input, label, [role="checkbox"], [role="button"]')) return
  if (!isRowToggleClick(e)) return
  openIds.value = openIds.value.includes(id) ? openIds.value.filter((x) => x !== id) : [...openIds.value, id]
}

const TITLED = new Set(['string', 'text', 'number', 'integer', 'enum', 'boolean', 'file'])
function titleOf(c: GeneratedColumn, row: Record<string, unknown>): string | undefined {
  if (!TITLED.has(c.fieldType)) return undefined
  const v = readPath(row, c.field)
  if (c.fieldType === 'file') return readArtifacts(v).map((a) => a.name).join('\n') || undefined
  return valueText(v) || undefined
}
const isStamp = (c: GeneratedColumn) => (c.cellClass ?? '').includes('stamp') || c.cellRendererParams?.stamp === true
</script>

<template>
  <div :dir="direction" class="min-w-0">
    <div v-if="selected.length" class="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-[13px] text-primary-soft-foreground">
      <span class="font-medium">{{ t('toolbar.selected', { count: selected.length }) }}</span>
      <Button size="xs" variant="ghost" :loading="downloading" @click="emit('archive', selectedEntities)"><FolderArchive /> {{ t('entities.downloadFiles') }}</Button>
      <Button size="xs" variant="ghost" class="ms-auto" @click="selected = []"><X /> {{ t('common.clear') }}</Button>
    </div>
    <p v-if="!entities.length" class="px-1 py-3 text-[13px] text-muted-foreground">{{ EMPTY_PLACEHOLDER }}</p>
    <div v-else class="overflow-x-auto rounded-xl border border-border">
      <div class="min-w-max">
        <div ref="header" class="flex items-stretch border-b border-border bg-muted/60 text-xs font-medium text-muted-foreground">
          <div class="flex w-10 shrink-0 items-center justify-center"><Checkbox :model-value="allState" @update:model-value="toggleAll" /></div>
          <div v-for="c in shown" :key="c.colId" :data-col="c.colId" class="relative flex items-center px-3 py-2" :class="isStamp(c) && 'justify-end'" :style="cellStyle(c)">
            <span class="truncate" :title="c.headerName" dir="auto">{{ c.headerName }}</span>
            <span class="sky-resize" role="separator" aria-orientation="vertical" @pointerdown="startResize($event, c.colId)" />
          </div>
          <div class="w-24 shrink-0" />
        </div>
        <template v-for="{ entity, row } in rows" :key="entity.id">
          <div
            class="group flex cursor-pointer items-stretch border-b border-border/70 bg-card text-[13px] transition-colors last:border-0 hover:bg-muted/50"
            :class="openIds.includes(entity.id) && 'bg-muted/40'"
            @click="onRowClick($event, entity.id)"
          >
            <div class="flex w-10 shrink-0 items-center justify-center" @click.stop>
              <Checkbox :model-value="selected.includes(entity.id)" :aria-label="entity.name" @update:model-value="(v) => toggleOne(entity.id, v)" />
            </div>
            <div v-for="c in shown" :key="c.colId" class="flex min-w-0 items-center px-3 py-2" :class="isStamp(c) && 'justify-end'" :style="cellStyle(c)" :title="titleOf(c, row)">
              <DynamicCell :column="c" :row="row" :taxonomy="taxonomy" class="w-full" @open="emit('open', $event)" @download="emit('download', $event)" />
            </div>
            <div class="flex w-24 shrink-0 items-center justify-end gap-0.5 pe-2">
              <Tooltip v-if="showHistory" :content="t('event.history')">
                <Button size="icon-xs" variant="ghost" :aria-label="t('event.history')" @click.stop="emit('history', entity)"><History /></Button>
              </Tooltip>
              <Tooltip :content="t('entities.downloadFiles')">
                <Button size="icon-xs" variant="ghost" :disabled="downloading" :aria-label="t('entities.downloadFiles')" @click.stop="emit('archive', [entity])"><Download /></Button>
              </Tooltip>
              <Tooltip :content="t('entities.edit')">
                <Button size="icon-xs" variant="ghost" :aria-label="t('entities.edit')" @click.stop="emit('edit', entity)"><Pencil /></Button>
              </Tooltip>
            </div>
          </div>
          <div v-if="openIds.includes(entity.id)" class="border-b border-border/70 bg-muted/30 px-4 py-3 last:border-0">
            <AttributesTable
              :columns="attributeColumns(columns, row)"
              :row="row"
              :taxonomy="taxonomy"
              :title="t('entities.attributes')"
              :empty-text="EMPTY_PLACEHOLDER"
              @open="emit('open', $event)"
              @download="emit('download', $event)"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style>
.sky-resize { position: absolute; inset-block: 4px; inset-inline-end: -3px; width: 7px; cursor: col-resize; z-index: 1; border-radius: 4px; }
.sky-resize::after { content: ''; position: absolute; inset-block: 2px; inset-inline-start: 3px; width: 1px; background: rgb(var(--border)); }
.sky-resize:hover::after { background: rgb(var(--primary)); width: 2px; }
</style>
