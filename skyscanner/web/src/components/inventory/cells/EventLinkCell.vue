<script setup lang="ts">
/**
 * A link to the event page: the brief (`display: 'name'`) or the running number. A plain click navigates in
 * place; ctrl/meta/shift/middle-click keep the browser's own behaviour (a new tab). Never toggles the row.
 */
import type { ICellRendererParams } from 'ag-grid-community'
import { EMPTY_PLACEHOLDER, HighlightedText, matchesTerm, valueDirection } from '@truth-platform/ui'
import { readContext, readRowId, type GridRow } from '@truth-platform/grid'
import { computed } from 'vue'

const props = defineProps<{ params: ICellRendererParams<GridRow> & { display?: string } }>()
const ctx = computed(() => readContext(props.params))
const id = computed(() => readRowId(props.params))
const href = computed(() => ctx.value.rowLink(id.value) ?? `/events/${encodeURIComponent(id.value)}`)
const raw = computed(() => (props.params.value === null || props.params.value === undefined ? '' : String(props.params.value)))
const label = computed(() => (props.params.display === 'name' ? raw.value : raw.value ? `#${raw.value}` : ''))

function onClick(e: MouseEvent) {
  e.stopPropagation()
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  ctx.value.openRow(id.value)
}
</script>

<template>
  <span v-if="!label" class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
  <a v-else :href="href" class="sky-link tabular-nums" :dir="valueDirection(label)" @click="onClick" @auxclick.stop>
    <HighlightedText v-if="matchesTerm(label, ctx.search)" :text="label" :term="ctx.search" />
    <template v-else>{{ label }}</template>
  </a>
</template>
