<script setup lang="ts">
/** Events side by side (spec §4.16): one column per event, one line per field; lines that differ stand out. */
import { GitCompareArrows, X } from 'lucide-vue-next'
import { Badge, Dialog, Switch, translate as t, usePreferences } from '@truth-platform/ui'
import type { GeneratedColumn, GridRow, TaxonomyItem } from '@truth-platform/grid'
import { computed, ref } from 'vue'
import type { Artifact } from '@/api/artifacts'
import { readPath } from '@truth-platform/ui'
import DynamicCell from '@/components/event/DynamicCell.vue'

const props = defineProps<{ rows: GridRow[]; columns: GeneratedColumn[]; taxonomy: TaxonomyItem[] }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ remove: [id: string]; open: [artifact: Artifact]; download: [artifact: Artifact] }>()
const { direction } = usePreferences()
const onlyDifferences = ref(false)

const CREATED: GeneratedColumn = {
  colId: 'created_at', field: 'created_at', headerName: '', headerNameHebrew: '', sortable: true, filter: false, floatingFilter: false, resizable: true,
  hide: false, editable: false, flex: null, minWidth: null, maxWidth: null, width: null, pinned: null, cellRenderer: 'DateCellRenderer',
  cellRendererParams: { withTime: true, stamp: true }, cellDataType: false, headerClass: null, cellClass: null, autoHeight: false, fieldType: 'datetime',
  dynamic: false, discovered: false, industry: null, filterOptions: [], quickFilter: false,
}
const lines = computed(() => {
  const cols = props.columns.filter((c) => c.headerName && !['open', 'expander', 'actions'].includes(c.colId))
  if (!cols.some((c) => c.colId === 'created_at')) cols.push({ ...CREATED, headerName: t('event.createdAt') })
  const norm = (v: unknown) => (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length) ? '' : JSON.stringify(v))
  return cols.map((c) => ({ column: c, differs: new Set(props.rows.map((r) => norm(readPath(r, c.field)))).size > 1 }))
})
const shown = computed(() => (onlyDifferences.value ? lines.value.filter((l) => l.differs) : lines.value))
</script>

<template>
  <Dialog v-model:open="open" size="2xl" class="max-w-[90rem]">
    <template #icon><GitCompareArrows /></template>
    <template #title>
      <span class="flex items-center gap-2">{{ t('compare.title') }} <Badge>{{ rows.length }}</Badge></span>
    </template>
    <template #description>
      <label class="mt-1 inline-flex items-center gap-2 text-[13px] text-foreground"><Switch v-model="onlyDifferences" size="sm" />{{ t('compare.onlyDifferences') }}</label>
    </template>
    <div :dir="direction" class="overflow-x-auto rounded-xl border border-border">
      <table class="min-w-full border-collapse text-[13px]">
        <thead>
          <tr class="bg-muted/60">
            <th class="sticky start-0 z-10 w-44 bg-muted px-3 py-2" />
            <th v-for="r in rows" :key="r.id" class="min-w-56 px-3 py-2 text-start align-top font-medium">
              <div class="flex items-start gap-2">
                <div class="min-w-0 flex-1">
                  <div class="tabular-nums text-muted-foreground">#{{ r.event_id }}</div>
                  <div class="truncate" dir="auto" :title="String(r.name ?? '')">{{ r.name }}</div>
                </div>
                <button type="button" class="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" :aria-label="t('compare.remove')" :title="t('compare.remove')" @click="emit('remove', String(r.id))">
                  <X class="size-3.5" />
                </button>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="l in shown" :key="l.column.colId" :class="['border-t border-border', l.differs && 'bg-warning-soft/40']">
            <th class="sticky start-0 z-10 bg-card px-3 py-2 text-start text-xs font-medium text-muted-foreground" :class="l.differs && 'bg-warning-soft'" dir="auto">{{ l.column.headerName }}</th>
            <td v-for="r in rows" :key="r.id" class="max-w-80 px-3 py-2 align-top">
              <DynamicCell :column="l.column" :row="r" :taxonomy="taxonomy" @open="emit('open', $event)" @download="emit('download', $event)" />
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="!shown.length" class="px-4 py-8 text-center text-[13px] text-muted-foreground">{{ t('compare.allSame') }}</p>
    </div>
  </Dialog>
</template>
