<script setup lang="ts">
/** A vocabulary value as a chip; an industry carries its icon and stays neutral (the inventory's own look). */
import type { ICellRendererParams } from 'ag-grid-community'
import { Badge, EMPTY_PLACEHOLDER, HighlightedText, matchesTerm } from '@truth-platform/ui'
import { readContext, readOptions, type GridRow } from '@truth-platform/grid'
import { computed } from 'vue'
import { iconFor } from '@/lib/icons'
import { lookOf } from '@/lib/tones'

const props = defineProps<{ params: ICellRendererParams<GridRow> & { palette?: string } }>()
const ctx = computed(() => readContext(props.params))
const raw = computed(() => (props.params.value === null || props.params.value === undefined ? '' : String(props.params.value)))
const look = computed(() => lookOf(raw.value, props.params.palette, readOptions(props.params), ctx.value.taxonomy))
const matched = computed(() => matchesTerm(look.value.label, ctx.value.search) || matchesTerm(raw.value, ctx.value.search))
</script>

<template>
  <span v-if="!raw" class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
  <Badge v-else :tone="look.tone" class="max-w-full">
    <component :is="iconFor(look.icon)" v-if="look.icon" />
    <span class="truncate" dir="auto">
      <HighlightedText v-if="matched" :text="look.label" :term="ctx.search" :stored="raw" />
      <template v-else>{{ look.label }}</template>
    </span>
  </Badge>
</template>
