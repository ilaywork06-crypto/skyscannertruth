<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community'
import { Maximize2 } from 'lucide-vue-next'
import { Badge, EMPTY_PLACEHOLDER, HighlightedText, ValueViewer, matchesTerm, translate as t } from '@truth-platform/ui'
import { computed, ref } from 'vue'
import { readContext } from '../context'
import type { GridRow } from '../types'
import { chipLook, headerOf, readOptions } from './look'

const props = defineProps<{ params: ICellRendererParams<GridRow> & { palette?: string; variant?: string } }>()
const ctx = computed(() => readContext(props.params))
const values = computed<string[]>(() => {
  const v = props.params.value
  if (Array.isArray(v)) return v.filter((x) => x !== null && x !== '').map(String)
  return v === null || v === undefined || v === '' ? [] : [String(v)]
})
const looks = computed(() => values.value.map((v) => ({ value: v, ...chipLook(v, props.params.palette, readOptions(props.params), ctx.value) })))
const joined = computed(() => looks.value.map((l) => l.label).join(', '))
const expandable = computed(() => joined.value.length > 48 || values.value.length > 3)
const open = ref(false)
const header = computed(() => headerOf(props.params, t('value.title')))
const matches = (l: { label: string; value: string }) => matchesTerm(l.label, ctx.value.search) || matchesTerm(l.value, ctx.value.search)
</script>

<template>
  <div class="gc-chips">
    <span v-if="!values.length" class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
    <span v-else-if="params.variant === 'plain'" class="gc-text__value" dir="auto">
      <HighlightedText v-if="matchesTerm(joined, ctx.search)" :text="joined" :term="ctx.search" />
      <template v-else>{{ joined }}</template>
    </span>
    <template v-else>
      <Badge v-for="l in looks" :key="l.value" :tone="l.tone">
        <span dir="auto">
          <HighlightedText v-if="matches(l)" :text="l.label" :term="ctx.search" :stored="l.value" />
          <template v-else>{{ l.label }}</template>
        </span>
      </Badge>
    </template>
    <button
      v-if="expandable"
      type="button"
      :class="['gc-expand', matchesTerm(joined, ctx.search) && 'gc-expand--matched']"
      :aria-label="t('value.readFull', { name: header })"
      @click.stop="open = true"
    >
      <Maximize2 />
    </button>
    <ValueViewer v-if="open" v-model:open="open" :value="looks.map((l) => `• ${l.label}`).join('\n')" :title="header" />
  </div>
</template>
