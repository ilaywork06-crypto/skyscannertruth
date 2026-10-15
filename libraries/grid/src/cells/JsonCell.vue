<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community'
import { Maximize2 } from 'lucide-vue-next'
import { EMPTY_PLACEHOLDER, ValueViewer, translate as t, truncate } from '@truth-platform/ui'
import { computed, ref } from 'vue'
import type { GridRow } from '../types'
import { headerOf } from './look'

const props = defineProps<{ params: ICellRendererParams<GridRow> }>()
const pretty = computed(() => (props.params.value === null || props.params.value === undefined ? '' : JSON.stringify(props.params.value, null, 2)))
const expandable = computed(() => pretty.value.length > 48 || pretty.value.includes('\n'))
const preview = computed(() => (pretty.value ? truncate(pretty.value.replace(/\s+/g, ' '), 48) : EMPTY_PLACEHOLDER))
const open = ref(false)
const header = computed(() => headerOf(props.params, t('value.title')))
</script>

<template>
  <div class="gc-text">
    <span class="gc-text__value mono text-xs" dir="ltr" @click="expandable && ($event.stopPropagation(), (open = true))">{{ preview }}</span>
    <button v-if="expandable" type="button" class="gc-expand" :aria-label="t('value.readFull', { name: header })" @click.stop="open = true"><Maximize2 /></button>
    <ValueViewer v-if="open" v-model:open="open" :value="pretty" :title="header" monospace />
  </div>
</template>
