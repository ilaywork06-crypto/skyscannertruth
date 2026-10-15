<script setup lang="ts">
/** An experiment's result as an icon: a check, a cross, or a check crossed out for a partial one. */
import type { ICellRendererParams } from 'ag-grid-community'
import { Check, X } from 'lucide-vue-next'
import { EMPTY_PLACEHOLDER, valueLabel } from '@truth-platform/ui'
import type { GridRow } from '@truth-platform/grid'
import { computed } from 'vue'

const props = defineProps<{ params: ICellRendererParams<GridRow> }>()
const value = computed(() => (typeof props.params.value === 'string' ? props.params.value : ''))
const label = computed(() => valueLabel(value.value))
</script>

<template>
  <span v-if="value === 'successful'" class="sky-result text-success" :title="label" role="img" :aria-label="label"><Check class="size-4" :stroke-width="2.5" /></span>
  <span v-else-if="value === 'failed'" class="sky-result text-danger" :title="label" role="img" :aria-label="label"><X class="size-4" :stroke-width="2.5" /></span>
  <span v-else-if="value === 'partial'" class="sky-result text-warning-foreground" :title="label" role="img" :aria-label="label">
    <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6 9 17l-5-5" /><path d="M5 19 19 5" stroke-width="1.6" opacity="0.7" />
    </svg>
  </span>
  <span v-else class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
</template>
