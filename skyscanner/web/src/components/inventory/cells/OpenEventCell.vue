<script setup lang="ts">
/** The row's arrow to its event page (a real link: new tab with a modifier or the middle button). */
import type { ICellRendererParams } from 'ag-grid-community'
import { ChevronRight } from 'lucide-vue-next'
import { translate as t } from '@truth-platform/ui'
import { readContext, readRowId, type GridRow } from '@truth-platform/grid'
import { computed } from 'vue'

const props = defineProps<{ params: ICellRendererParams<GridRow> }>()
const ctx = computed(() => readContext(props.params))
const id = computed(() => readRowId(props.params))
const href = computed(() => ctx.value.rowLink(id.value) ?? `/events/${encodeURIComponent(id.value)}`)
function onClick(e: MouseEvent) {
  e.stopPropagation()
  if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  ctx.value.openRow(id.value)
}
</script>

<template>
  <a
    :href="href"
    class="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-primary"
    :aria-label="t('event.open')"
    :title="t('event.open')"
    @click="onClick"
    @auxclick.stop
  >
    <ChevronRight class="size-4 rtl:rotate-180" />
  </a>
</template>
