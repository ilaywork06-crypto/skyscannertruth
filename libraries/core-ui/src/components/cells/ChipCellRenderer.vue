<template>
  <!--
    The marker pen goes inside the chip rather than behind it: laying a band over the whole chip said only
    that something in this cell matched, where the reader is looking for which characters of it did.
  -->
  <UiChip
    v-if="raw.length > 0"
    :label="look.label"
    :token="look.token"
    :icon="look.icon"
  >
    <HighlightedText
      v-if="isMatch"
      :text="look.label"
      :term="search"
      :stored="raw"
    />
    <template v-else>
      {{ look.label }}
    </template>
  </UiChip>
  <span
    v-else
    class="chip-cell__empty"
  >{{ EMPTY_PLACEHOLDER }}</span>
</template>

<script lang="ts">
import type { ICellRendererParams } from 'ag-grid-community'
import { EMPTY_PLACEHOLDER, UiChip } from '../../index'
import type { GridRow } from '../../models/grid'

interface Props {
  params: ICellRendererParams<GridRow> & { palette?: string }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

import HighlightedText from '../../components/HighlightedText.vue'
import { language } from '../../composables/useLanguage'
import { chipLook, readColumnOptions, type ChipLook } from '../../utils/chips'
import { readContext } from '../../utils/grid-context'
import { matchesTerm } from '../../utils/highlight'

const props = defineProps<Props>()

const raw = computed<string>(() => {
  const value = props.params.value

  return value === null || value === undefined ? '' : String(value)
})

/*
 * The language is read here so that a cell drawn after a language change names its value in the new one; the
 * table is rebuilt on a language change anyway, which is what redraws the cells that were already on screen.
 */
const look = computed<ChipLook>(() => {
  void language.value

  return chipLook(
    raw.value,
    props.params.palette,
    readColumnOptions(props.params.colDef?.filterParams),
    readContext(props.params).taxonomy,
  )
})

const search = computed<string>(() => readContext(props.params).search)

const isMatch = computed<boolean>(
  () => raw.value.length > 0 && (matchesTerm(look.value.label, search.value) || matchesTerm(raw.value, search.value)),
)
</script>

<style>
.chip-cell__empty {
  opacity: 0.6;
}
</style>
