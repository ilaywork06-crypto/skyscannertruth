<script setup lang="ts">
/** Attributes of one record as a band of labelled values (one column each), scrolling sideways when many. */
import { translate as t, usePreferences } from '@truth-platform/ui'
import type { GeneratedColumn, GridRow, TaxonomyItem } from '@truth-platform/grid'
import type { Artifact } from '@/api/artifacts'
import DynamicCell from './DynamicCell.vue'

withDefaults(defineProps<{ columns: GeneratedColumn[]; row: GridRow; taxonomy?: TaxonomyItem[]; title?: string; emptyText?: string }>(), {
  taxonomy: () => [],
  title: '',
  emptyText: '',
})
const emit = defineEmits<{ open: [artifact: Artifact]; download: [artifact: Artifact] }>()
const { direction } = usePreferences()
</script>

<template>
  <div :dir="direction">
    <h4 v-if="title" class="mb-2 text-[13px] font-semibold">{{ title }}</h4>
    <div v-if="columns.length" class="overflow-x-auto rounded-xl border border-border">
      <div class="grid min-w-full" :style="{ gridTemplateColumns: `repeat(${columns.length}, minmax(11rem, 1fr))` }">
        <div v-for="c in columns" :key="`h:${c.colId}`" class="border-b border-border bg-muted/60 px-3 py-2 text-xs font-medium text-muted-foreground">
          <div class="truncate" dir="auto" :title="c.headerName">{{ c.headerName }}</div>
          <div v-if="c.discovered" class="text-[11px] font-normal italic text-muted-foreground/80">{{ t('attributes.notDeclared') }}</div>
        </div>
        <div v-for="c in columns" :key="`v:${c.colId}`" class="min-w-0 bg-card px-3 py-2.5">
          <DynamicCell :column="c" :row="row" :taxonomy="taxonomy" @open="emit('open', $event)" @download="emit('download', $event)" />
        </div>
      </div>
    </div>
    <p v-else class="text-[13px] text-muted-foreground">{{ emptyText || t('attributes.empty') }}</p>
  </div>
</template>
