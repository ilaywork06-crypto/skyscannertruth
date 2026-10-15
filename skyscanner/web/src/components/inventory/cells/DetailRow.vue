<script setup lang="ts">
/** The full-width row under an expanded event: its detail panel, measured so the row is exactly as tall. */
import type { ICellRendererParams } from 'ag-grid-community'
import { readContext, type GridRow } from '@truth-platform/grid'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Artifact } from '@/api/artifacts'
import EventDetailPanel from '../EventDetailPanel.vue'

const props = defineProps<{ params: ICellRendererParams<GridRow> }>()
const ctx = computed(() => readContext(props.params))
const parentId = computed(() => String(props.params.data?.parentId ?? ''))
const row = computed(() => ctx.value.findRow(parentId.value))
const root = ref<HTMLElement>()
let observer: ResizeObserver | null = null
const report = (h: number) => (ctx.value.extra.reportDetailHeight as ((id: string, h: number) => void) | undefined)?.(parentId.value, h)

onMounted(() => {
  if (!root.value || typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver((entries) => report(entries[0].contentRect.height))
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="sky-detail">
    <div ref="root">
      <EventDetailPanel
        :event-id="parentId"
        :event-row="row"
        :taxonomy="ctx.taxonomy"
        @open="(a: Artifact) => ctx.openArtifact(a as unknown as Record<string, unknown>)"
      />
    </div>
  </div>
</template>
