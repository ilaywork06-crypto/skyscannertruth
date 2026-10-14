<script setup lang="ts">
/**
 * A value of text. Long or multi-line values are windowed (around the search match when there is one) and
 * open whole in the viewer; a value shown whole has its links made followable.
 */
import type { ICellRendererParams } from 'ag-grid-community'
import { Maximize2 } from 'lucide-vue-next'
import { EMPTY_PLACEHOLDER, HighlightedText, LinkedText, ValueViewer, matchesTerm, previewAround, translate as t, valueDirection, valueText } from '@truth-platform/ui'
import { computed, ref } from 'vue'
import { readContext } from '../context'
import type { GridRow } from '../types'
import { headerOf } from './look'

const props = defineProps<{ params: ICellRendererParams<GridRow> & { display?: string } }>()
const LIMIT = 64
const ctx = computed(() => readContext(props.params))
const text = computed(() => valueText(props.params.value))
const isList = computed(() => props.params.colDef?.cellRendererParams?.display === 'list')
const items = computed(() => text.value.split('\n').map((s) => s.trim()).filter(Boolean))
const wraps = computed(() => props.params.colDef?.wrapText === true)
const expandable = computed(() => !wraps.value && (text.value.length > LIMIT || items.value.length > 1))
const full = computed(() => (isList.value ? items.value.map((i) => `• ${i}`).join('\n') : text.value))
const oneLine = computed(() => (isList.value ? items.value.join(' · ') : text.value.replace(/\s+/g, ' ')))
const display = computed(() => (!text.value ? EMPTY_PLACEHOLDER : wraps.value ? full.value : previewAround(oneLine.value, ctx.value.search, LIMIT)))
const isMatch = computed(() => matchesTerm(display.value, ctx.value.search))
const hidesMatch = computed(() => expandable.value && matchesTerm(text.value, ctx.value.search))
const open = ref(false)
const header = computed(() => headerOf(props.params, t('value.title')))
function openViewer(e: Event) {
  if (!expandable.value) return
  e.stopPropagation()
  open.value = true
}
</script>

<template>
  <div :class="['gc-text', wraps && 'gc-text--wrap']">
    <span class="gc-text__value" :dir="valueDirection(display)" @click="openViewer">
      <LinkedText v-if="!expandable" :text="display" :term="isMatch ? ctx.search : ''" />
      <HighlightedText v-else-if="isMatch" :text="display" :term="ctx.search" />
      <template v-else>{{ display }}</template>
    </span>
    <button
      v-if="expandable"
      type="button"
      :class="['gc-expand', hidesMatch && 'gc-expand--matched']"
      :aria-label="t('value.readFull', { name: header })"
      @click.stop="open = true"
    >
      <Maximize2 />
    </button>
    <ValueViewer v-if="open" v-model:open="open" :value="full" :title="header" />
  </div>
</template>
