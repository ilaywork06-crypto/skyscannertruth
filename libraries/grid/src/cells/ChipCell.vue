<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community'
import { Badge, EMPTY_PLACEHOLDER, HighlightedText, matchesTerm } from '@truth-platform/ui'
import { computed } from 'vue'
import { readContext } from '../context'
import type { GridRow } from '../types'
import { chipLook, readOptions } from './look'

const props = defineProps<{ params: ICellRendererParams<GridRow> & { palette?: string } }>()
const ctx = computed(() => readContext(props.params))
const raw = computed(() => (props.params.value === null || props.params.value === undefined ? '' : String(props.params.value)))
const look = computed(() => chipLook(raw.value, props.params.palette, readOptions(props.params), ctx.value))
const matched = computed(() => matchesTerm(look.value.label, ctx.value.search) || matchesTerm(raw.value, ctx.value.search))
</script>

<template>
  <span v-if="!raw" class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
  <Badge v-else :tone="look.tone" class="max-w-full">
    <span class="truncate" dir="auto">
      <HighlightedText v-if="matched" :text="look.label" :term="ctx.search" :stored="raw" />
      <template v-else>{{ look.label }}</template>
    </span>
  </Badge>
</template>
