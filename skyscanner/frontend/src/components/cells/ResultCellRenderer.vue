<template>
  <!--
    The result of an experiment is one of three answers, and a mark says which in a fraction of the room a word
    takes: a tick for a success, a cross for a failure, and for a partial one a single cross whose lower arm
    bends into the short stroke of a tick. The word is kept for whoever points at the mark and for anything
    reading the page aloud.
  -->
  <span
    v-if="raw in RESULT_MARKS"
    class="result-cell"
    role="img"
    :title="label"
    :aria-label="label"
  >
    <!-- No icon set has the partial mark, so it is drawn here, in the stroke and size of the other two. -->
    <svg
      v-if="raw === PARTIAL"
      class="result-cell__partial"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M3.5 13 L8.5 18 L19.5 5.5" />
      <path d="M5.5 6 L17.5 18" />
    </svg>
    <v-icon
      v-else
      :icon="RESULT_MARKS[raw]"
      size="18"
    />
  </span>
  <span
    v-else
    class="result-cell__empty"
  >{{ EMPTY_PLACEHOLDER }}</span>
</template>

<script lang="ts">
import type { ICellRendererParams } from 'ag-grid-community'
import { EMPTY_PLACEHOLDER } from '@truth-platform/core-ui'
import type { GridRow } from '@/models/grid'

interface Props {
  params: ICellRendererParams<GridRow>
}

/** A result that succeeded in part and failed in part, which is drawn rather than taken from the icon set. */
const PARTIAL = 'partial'

/** The mark each result is drawn with. */
const RESULT_MARKS: Record<string, string> = {
  successful: 'mdi-check',
  failed: 'mdi-close',
  [PARTIAL]: '',
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { language, valueLabel } from '@truth-platform/core-ui'

const props = defineProps<Props>()

const raw = computed<string>(() => {
  const value = props.params.value

  return value === null || value === undefined ? '' : String(value)
})

const label = computed<string>(() => {
  void language.value

  return valueLabel(raw.value)
})
</script>

<!--
  AG Grid mounts a cell renderer outside the Vue render tree, so a scoped block here would style nothing.
-->
<style>
.result-cell {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

/* The same box and weight as the icons beside it, so the three marks read as one set. */
.result-cell__partial {
  inline-size: 18px;
  block-size: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: square;
  stroke-linejoin: miter;
}

.result-cell__empty {
  opacity: 0.6;
}
</style>
