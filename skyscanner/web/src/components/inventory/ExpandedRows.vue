<script setup lang="ts">
/** The rows open right now: a chip each (jump to it, or close it), compare them, or close them all. */
import { ChevronsDownUp, GitCompareArrows, PanelTopOpen, X } from 'lucide-vue-next'
import { Button, translate as t } from '@truth-platform/ui'
import type { GridRow } from '@truth-platform/grid'

defineProps<{ ids: string[]; findRow: (id: string) => GridRow | undefined }>()
const emit = defineEmits<{ reveal: [id: string]; collapse: [id: string]; compare: []; collapseAll: [] }>()
</script>

<template>
  <div v-if="ids.length" class="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 shadow-soft">
    <span class="me-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><PanelTopOpen class="size-3.5" />{{ ids.length }}</span>
    <span v-for="id in ids" :key="id" class="inline-flex h-7 max-w-72 items-center rounded-full border border-border bg-muted/50 text-xs">
      <button type="button" class="flex min-w-0 items-center gap-1 ps-3 pe-1" :title="t('open.goTo')" @click="emit('reveal', id)">
        <template v-if="findRow(id)">
          <span class="font-medium tabular-nums">#{{ findRow(id)!.event_id }}</span>
          <span class="truncate text-muted-foreground" dir="auto">{{ findRow(id)!.name }}</span>
        </template>
        <span v-else class="font-mono">{{ id.slice(0, 6) }}</span>
      </button>
      <button type="button" class="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" :aria-label="t('open.close')" @click="emit('collapse', id)">
        <X class="size-3" />
      </button>
    </span>
    <div class="ms-auto flex items-center gap-1">
      <Button size="xs" variant="ghost" :disabled="ids.length < 2" @click="emit('compare')"><GitCompareArrows /> {{ t('open.compare') }}</Button>
      <Button size="xs" variant="ghost" @click="emit('collapseAll')"><ChevronsDownUp /> {{ t('inventory.collapseAll') }}</Button>
    </div>
  </div>
</template>
