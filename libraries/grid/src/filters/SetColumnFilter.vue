<script setup lang="ts">
/**
 * Filtering by picking. A column whose values are a declared vocabulary carries it as `filterOptions`, and this
 * filter lists them to tick. The filtering itself happens on the service, so `doesFilterPass` is always true.
 * Model: `{ filterType: 'set', values: [...] }`, or null when nothing is ticked.
 */
import type { IFilterParams } from 'ag-grid-community'
import { Search } from 'lucide-vue-next'
import { Button, Checkbox, localLabel, translate as t } from '@truth-platform/ui'
import { computed, ref } from 'vue'
import type { FilterOption } from '../types'

const props = defineProps<{ params: IFilterParams & { options?: FilterOption[]; headerName?: string } }>()
const picked = ref<string[]>([])
const term = ref('')
const options = computed(() => props.params.options ?? [])
const searchable = computed(() => options.value.length >= 8)
const shown = computed(() => {
  const needle = term.value.trim().toLowerCase()
  if (!needle) return options.value
  return options.value.filter((o) => localLabel(o.label, o.labelHebrew).toLowerCase().includes(needle) || o.value.toLowerCase().includes(needle))
})

function changed() {
  props.params.filterChangedCallback()
}
function toggle(value: string, on: boolean) {
  picked.value = on ? [...picked.value, value] : picked.value.filter((v) => v !== value)
  changed()
}
function selectAll() {
  picked.value = [...new Set([...picked.value, ...shown.value.map((o) => o.value)])]
  changed()
}
function clear() {
  picked.value = []
  changed()
}

defineExpose({
  isFilterActive: () => picked.value.length > 0,
  doesFilterPass: () => true,
  getModel: () => (picked.value.length ? { filterType: 'set', values: [...picked.value] } : null),
  setModel: (model: { values?: unknown[] } | null) => {
    picked.value = Array.isArray(model?.values) ? model!.values!.map(String) : []
  },
})
</script>

<template>
  <div class="gc-set-filter">
    <div v-if="searchable" class="relative mb-2">
      <Search class="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <input
        v-model="term"
        autofocus
        class="h-8 w-full rounded-md border border-input bg-card pe-2 ps-8 text-[13px] outline-none focus:border-primary"
        :placeholder="t('filters.searchIn', { field: params.headerName ?? t('filters.values') })"
      />
    </div>
    <div class="mb-1.5 flex gap-1">
      <Button size="xs" variant="ghost" :disabled="!shown.length" @click="selectAll">{{ t('filters.selectAll') }}</Button>
      <Button size="xs" variant="ghost" :disabled="!picked.length" @click="clear">{{ t('filters.clear') }}</Button>
    </div>
    <div class="max-h-60 overflow-y-auto">
      <p v-if="!shown.length" class="px-2 py-3 text-[13px] text-muted-foreground">{{ t('filters.noMatch', { term }) }}</p>
      <label v-for="o in shown" :key="o.value" class="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] hover:bg-muted">
        <Checkbox :model-value="picked.includes(o.value)" @update:model-value="(v) => toggle(o.value, v === true)" />
        <span dir="auto" class="truncate">{{ localLabel(o.label, o.labelHebrew) }}</span>
      </label>
    </div>
  </div>
</template>
