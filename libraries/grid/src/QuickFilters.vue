<script setup lang="ts">
/**
 * The pills for the vocabularies a reader narrows by every day. A pill writes into the filter of its own column,
 * so a pick is the same restriction a header filter would be: it shows as a chip, travels into a saved view, and
 * lights back up when the view is reopened. Stateless - the ticks are read off the current conditions.
 */
import { Check, ChevronDown, X, Zap } from 'lucide-vue-next'
import { DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from 'reka-ui'
import { cn, joinIsolated, localLabel, translate as t, usePreferences } from '@truth-platform/ui'
import { computed } from 'vue'
import type { FilterCondition, GeneratedColumn } from './types'

export interface QuickFilterChoice {
  colId: string
  values: string[]
}

const props = defineProps<{ columns: GeneratedColumn[]; filters: FilterCondition[] }>()
const emit = defineEmits<{ update: [choice: QuickFilterChoice] }>()
const { direction } = usePreferences()

const pills = computed(() =>
  props.columns
    .filter((c) => c.quickFilter && c.filterOptions.length)
    .map((c) => {
      const picked = props.filters.filter((f) => f.key === c.colId && f.operator === 'in').flatMap((f) => f.values.map(String))
      const labels = picked.map((v) => {
        const o = c.filterOptions.find((x) => x.value === v)
        return o ? localLabel(o.label, o.labelHebrew) : v
      })
      return { column: c, picked, summary: picked.length > 2 ? t('quick.picked', { count: picked.length }) : joinIsolated(labels) }
    }),
)
const anyPicked = computed(() => pills.value.some((p) => p.picked.length))

function toggle(colId: string, picked: string[], value: string) {
  emit('update', { colId, values: picked.includes(value) ? picked.filter((v) => v !== value) : [...picked, value] })
}
function clearAll() {
  for (const p of pills.value) if (p.picked.length) emit('update', { colId: p.column.colId, values: [] })
}
</script>

<template>
  <div v-if="pills.length" class="flex flex-wrap items-center gap-1.5">
    <span class="me-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><Zap class="size-3.5" />{{ t('quick.label') }}</span>
    <DropdownMenuRoot v-for="p in pills" :key="p.column.colId" :dir="direction" :modal="false">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          :class="cn(
            'inline-flex h-7 max-w-64 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
            p.picked.length ? 'border-primary/40 bg-primary-soft text-primary-soft-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
          )"
        >
          <span class="truncate" dir="auto">{{ p.column.headerName }}</span>
          <span v-if="p.picked.length" class="truncate font-normal" dir="auto">· {{ p.summary }}</span>
          <ChevronDown class="size-3.5 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent align="start" :side-offset="6" class="z-50 max-h-80 min-w-52 animate-in overflow-y-auto rounded-xl border border-border bg-popover p-1 text-sm shadow-pop">
          <DropdownMenuCheckboxItem
            v-for="o in p.column.filterOptions"
            :key="o.value"
            :model-value="p.picked.includes(o.value)"
            class="flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 outline-none data-[highlighted]:bg-muted"
            @select="(e: Event) => { e.preventDefault(); toggle(p.column.colId, p.picked, o.value) }"
          >
            <span class="grid size-4 place-items-center"><Check v-if="p.picked.includes(o.value)" class="size-4 text-primary" /></span>
            <span dir="auto">{{ localLabel(o.label, o.labelHebrew) }}</span>
          </DropdownMenuCheckboxItem>
          <template v-if="p.picked.length">
            <DropdownMenuSeparator class="my-1 h-px bg-border" />
            <DropdownMenuItem class="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-muted-foreground outline-none data-[highlighted]:bg-muted" @select="emit('update', { colId: p.column.colId, values: [] })">
              <X class="size-4" /> {{ t('filters.clear') }}
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
    <button v-if="anyPicked" type="button" class="ms-1 text-xs font-medium text-muted-foreground hover:text-foreground" @click="clearAll">{{ t('quick.clear') }}</button>
  </div>
</template>
