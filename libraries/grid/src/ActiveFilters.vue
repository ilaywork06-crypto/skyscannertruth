<script setup lang="ts">
/** Every restriction on the table as a removable chip: the search, a scope, and each column condition. */
import { FilterX, X } from 'lucide-vue-next'
import { humanizeKey, isolate, joinIsolated, localLabel, translate as t, usePreferences } from '@truth-platform/ui'
import { computed } from 'vue'
import type { FilterCondition, GeneratedColumn } from './types'

export interface FilterChip {
  id: string
  kind: 'search' | 'scope' | 'column'
  field: string
  value: string
  colId: string
  index: number
}
export interface ScopeFilter {
  field: string
  value: string
}

const props = withDefaults(
  defineProps<{ search: string; scope?: ScopeFilter | null; filters: FilterCondition[]; columns: GeneratedColumn[]; fieldLabels?: Record<string, string> }>(),
  { scope: null, fieldLabels: () => ({}) },
)
const emit = defineEmits<{ remove: [chip: FilterChip]; clear: [] }>()
const { language } = usePreferences()

function headerOf(key: string): string {
  return props.fieldLabels[key] || props.columns.find((c) => c.colId === key)?.headerName || humanizeKey(key)
}
function labelOf(key: string, v: string): string {
  const o = props.columns.find((c) => c.colId === key)?.filterOptions.find((x) => x.value === v)
  return o ? localLabel(o.label, o.labelHebrew) : v
}
function valueOf(c: FilterCondition): string {
  const op = t(`operator.${c.operator}`)
  if (c.operator === 'is_empty' || c.operator === 'is_not_empty') return op
  const rendered = c.values.length ? joinIsolated(c.values.map((v) => labelOf(c.key, String(v ?? '')))) : isolate(labelOf(c.key, String(c.value ?? '')))
  return c.operator === 'equals' ? rendered : `${op} ${rendered}`
}

const chips = computed<FilterChip[]>(() => {
  void language.value
  const out: FilterChip[] = []
  if (props.search.trim()) out.push({ id: 'search', kind: 'search', field: t('filters.search'), value: props.search, colId: '', index: -1 })
  if (props.scope) out.push({ id: 'scope', kind: 'scope', field: props.scope.field, value: props.scope.value, colId: '', index: -1 })
  props.filters.forEach((c, i) => out.push({ id: `column:${c.key}:${i}`, kind: 'column', field: headerOf(c.key), value: valueOf(c), colId: c.key, index: i }))
  return out
})
</script>

<template>
  <div v-if="chips.length" class="flex flex-wrap items-center gap-1.5">
    <span class="me-1 text-xs font-medium text-muted-foreground">{{ t('filters.activeLabel') }}</span>
    <button
      v-for="chip in chips"
      :key="chip.id"
      type="button"
      class="inline-flex h-7 max-w-80 items-center gap-1 rounded-full border border-border bg-card ps-3 pe-1.5 text-xs shadow-soft hover:bg-muted"
      :aria-label="t('filters.remove', { label: `${chip.field}: ${chip.value}` })"
      @click="emit('remove', chip)"
    >
      <span class="font-medium" dir="auto">{{ chip.field }}:</span>
      <span class="truncate text-muted-foreground" dir="auto">{{ chip.value }}</span>
      <X class="size-3.5 shrink-0 text-muted-foreground" />
    </button>
    <button type="button" class="ms-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-danger" @click="emit('clear')">
      <FilterX class="size-3.5" /> {{ t('filters.clearAll') }}
    </button>
  </div>
</template>
