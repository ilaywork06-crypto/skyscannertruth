<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community'
import { MapPin } from 'lucide-vue-next'
import { EMPTY_PLACEHOLDER, formatCoordinate, toCoordinate } from '@truth-platform/ui'
import { computed } from 'vue'
import type { GridRow } from '../types'

const props = defineProps<{ params: ICellRendererParams<GridRow> }>()
const point = computed(() => toCoordinate(props.params.value))
</script>

<template>
  <span v-if="!point" class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
  <span v-else class="inline-flex items-center gap-1.5 tabular-nums" dir="ltr"><MapPin class="size-3.5 text-muted-foreground" />{{ formatCoordinate(point) }}</span>
</template>
