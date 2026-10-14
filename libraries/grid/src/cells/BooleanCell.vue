<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community'
import { CheckCircle2, MinusCircle } from 'lucide-vue-next'
import { computed } from 'vue'
import type { GridRow } from '../types'

const props = defineProps<{ params: ICellRendererParams<GridRow> }>()
const yes = computed(() => props.params.value === true || props.params.value === 'true')
</script>

<template>
  <CheckCircle2 v-if="yes" class="size-4 text-success" />
  <MinusCircle v-else class="size-4 text-muted-foreground/60" />
</template>
