<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community'
import { ChevronDown } from 'lucide-vue-next'
import { translate as t } from '@truth-platform/ui'
import { computed } from 'vue'
import { readContext, readRowId } from '../context'
import type { GridRow } from '../types'

const props = defineProps<{ params: ICellRendererParams<GridRow> }>()
const ctx = computed(() => readContext(props.params))
const id = computed(() => readRowId(props.params))
const open = computed(() => ctx.value.expandedIds.includes(id.value))
</script>

<template>
  <button
    type="button"
    class="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    :aria-label="open ? t('row.collapse') : t('row.expand')"
    :aria-expanded="open"
    @click.stop="ctx.toggleExpanded(id)"
  >
    <ChevronDown :class="['size-4 transition-transform', open && 'rotate-180']" />
  </button>
</template>
