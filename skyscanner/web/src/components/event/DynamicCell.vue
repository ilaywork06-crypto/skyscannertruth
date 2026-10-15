<script setup lang="ts">
/**
 * One generated column drawn against one row outside AG Grid (attribute tables, the compare table, entity
 * tables): chips, a status, a yes/no, a point, files with their upload line, dates, or text with links.
 */
import { CheckCircle2, MapPin, XCircle } from 'lucide-vue-next'
import {
  Badge, EMPTY_PLACEHOLDER, HighlightedText, LinkedText, formatCompactDateTime, formatCoordinate, formatDate, formatDateTime,
  matchesTerm, readPath, readText, toCoordinate, valueDirection, valueLabel,
} from '@truth-platform/ui'
import type { GeneratedColumn, GridRow, TaxonomyItem } from '@truth-platform/grid'
import { computed } from 'vue'
import type { Artifact } from '@/api/artifacts'
import { useSearchTerm } from '@/composables/useSearchTerm'
import { readArtifacts } from '@/lib/events'
import { iconFor } from '@/lib/icons'
import { lookOf, statusTone } from '@/lib/tones'
import FileList from './FileList.vue'

const props = withDefaults(defineProps<{ column: GeneratedColumn; row: GridRow; taxonomy?: TaxonomyItem[] }>(), { taxonomy: () => [] })
const emit = defineEmits<{ open: [artifact: Artifact]; download: [artifact: Artifact] }>()
const search = useSearchTerm()

type Kind = 'chip' | 'chips' | 'coordinate' | 'boolean' | 'status' | 'files' | 'date' | 'text'
const kind = computed<Kind>(() => {
  const r = props.column.cellRenderer ?? ''
  if (r.startsWith('ChipList')) return 'chips'
  if (r.startsWith('Chip')) return 'chip'
  if (r.startsWith('Coordinate')) return 'coordinate'
  if (r.startsWith('Boolean')) return 'boolean'
  if (r.startsWith('Status') || r.startsWith('Result')) return 'status'
  if (r.startsWith('Files')) return 'files'
  if (r.startsWith('Date')) return 'date'
  return 'text'
})
const params = computed(() => props.column.cellRendererParams ?? {})
const palette = computed(() => (typeof params.value.palette === 'string' ? params.value.palette : undefined))
const raw = computed(() => readPath(props.row, props.column.field))
const text = computed(() => readText(props.row, props.column.field))

const look = (v: string) => lookOf(v, palette.value, props.column.filterOptions ?? [], props.taxonomy)
const chips = computed(() => {
  const v = raw.value
  const values = Array.isArray(v) ? v.filter((x) => x !== null && x !== '').map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))) : text.value ? [text.value] : []
  return values.map((value) => ({ value, ...look(value) }))
})
const matches = (label: string, value: string) => matchesTerm(label, search.value) || matchesTerm(value, search.value)

const isYes = computed(() => raw.value === true || raw.value === 'true')
const point = computed(() => toCoordinate(raw.value))
const files = computed(() => readArtifacts(raw.value))
const dateText = computed(() => {
  const fmt = params.value.withTime !== true ? formatDate : params.value.stamp === true ? formatCompactDateTime : formatDateTime
  const v = raw.value
  const moments = (Array.isArray(v) ? v : [v]).filter((x) => typeof x === 'string' && x !== '') as string[]
  return moments.length ? moments.map(fmt).join(', ') : EMPTY_PLACEHOLDER
})
const statusLabel = computed(() => {
  const option = props.column.filterOptions?.find((o) => o.value === text.value)
  return option ? look(text.value).label : valueLabel(text.value)
})
const textMatched = computed(() => matchesTerm(text.value, search.value))
</script>

<template>
  <div class="sky-dyn">
    <template v-if="kind === 'chips' || kind === 'chip'">
      <span v-if="!chips.length" class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
      <div v-else class="flex flex-wrap gap-1">
        <Badge v-for="c in chips" :key="c.value" :tone="c.tone">
          <component :is="iconFor(c.icon)" v-if="c.icon" />
          <span dir="auto">
            <HighlightedText v-if="matches(c.label, c.value)" :text="c.label" :term="search" :stored="c.value" />
            <template v-else>{{ c.label }}</template>
          </span>
        </Badge>
      </div>
    </template>
    <template v-else-if="kind === 'status'">
      <span v-if="!text" class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
      <Badge v-else :tone="statusTone(text, palette) ?? 'neutral'" dot>
        <HighlightedText v-if="matches(statusLabel, text)" :text="statusLabel" :term="search" :stored="text" />
        <template v-else>{{ statusLabel }}</template>
      </Badge>
    </template>
    <template v-else-if="kind === 'boolean'">
      <span v-if="raw === null || raw === ''" class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
      <CheckCircle2 v-else-if="isYes" class="size-4 text-success" />
      <XCircle v-else class="size-4 text-muted-foreground/70" />
    </template>
    <template v-else-if="kind === 'coordinate'">
      <span v-if="!point" class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
      <span v-else class="inline-flex items-center gap-1.5 tabular-nums" dir="ltr"><MapPin class="size-3.5 text-muted-foreground" />{{ formatCoordinate(point) }}</span>
    </template>
    <FileList v-else-if="kind === 'files'" :files="files" :flat="params.flat === true" :search="search" show-upload @open="emit('open', $event)" @download="emit('download', $event)" />
    <span v-else-if="kind === 'date'" :class="['tabular-nums', params.stamp === true && 'gc-date--stamp']" dir="ltr">{{ dateText }}</span>
    <template v-else>
      <span v-if="!text" class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
      <span v-else class="sky-dyn__text" :dir="valueDirection(text)" :title="text"><LinkedText :text="text" :term="textMatched ? search : ''" /></span>
    </template>
  </div>
</template>

<style>
.sky-dyn { min-width: 0; font-size: 13px; }
.sky-dyn__text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; unicode-bidi: plaintext; text-align: start; }
</style>
