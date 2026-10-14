<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community'
import { EMPTY_PLACEHOLDER, formatCompactDateTime, formatDate, formatDateTime } from '@truth-platform/ui'
import { computed } from 'vue'
import type { GridRow } from '../types'

const props = defineProps<{ params: ICellRendererParams<GridRow> & { withTime?: boolean; stamp?: boolean } }>()
const text = computed(() => {
  const v = props.params.value
  const moments = (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string' && x !== '')
  if (!moments.length) return EMPTY_PLACEHOLDER
  const fmt = props.params.withTime !== true ? formatDate : props.params.stamp === true ? formatCompactDateTime : formatDateTime
  return moments.map(fmt).join(', ')
})
</script>

<template>
  <span :class="['gc-date', params.stamp && 'gc-date--stamp']" dir="ltr">{{ text }}</span>
</template>
