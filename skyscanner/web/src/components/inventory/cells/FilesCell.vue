<script setup lang="ts">
/** The files of a row, folders open, opening in the viewer. */
import type { ICellRendererParams } from 'ag-grid-community'
import { readContext, type GridRow } from '@truth-platform/grid'
import { computed } from 'vue'
import type { Artifact } from '@/api/artifacts'
import { readArtifacts } from '@/lib/events'
import FileList from '@/components/event/FileList.vue'

const props = defineProps<{ params: ICellRendererParams<GridRow> & { flat?: boolean } }>()
const ctx = computed(() => readContext(props.params))
const files = computed(() => readArtifacts(props.params.value))
</script>

<template>
  <FileList
    :files="files"
    start-open
    :flat="params.flat === true"
    :search="ctx.search"
    @open="(a: Artifact) => ctx.openArtifact(a as unknown as Record<string, unknown>)"
    @download="(a: Artifact) => ctx.downloadArtifact(a as unknown as Record<string, unknown>)"
  />
</template>
