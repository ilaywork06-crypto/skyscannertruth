<template>
  <!--
    The values of an entity - what it is called, where it came from, what was noted about it - are searched
    by the same box the events above are, so a cell inside an expanded row paints its matches exactly as the
    cells of the table around it do. On the event page nothing was searched, and every branch renders the
    plain value it always did.
  -->
  <!-- A value that is a list of its own is painted chip by chip, which is how the platforms of an event read. -->
  <span
    v-if="kind === 'chips'"
    class="dynamic-cell__chips"
  >
    <UiChip
      v-for="item in itemLooks"
      :key="item.value"
      :label="item.label"
      :token="item.token"
      :icon="item.icon"
    >
      <HighlightedText
        v-if="isMatch(item.label) || isMatch(item.value)"
        :text="item.label"
        :term="search"
        :stored="item.value"
      />
      <template v-else>
        {{ item.label }}
      </template>
    </UiChip>
    <span v-if="items.length === 0">{{ EMPTY_PLACEHOLDER }}</span>
  </span>
  <span
    v-else-if="(kind === 'status' || kind === 'chip') && text.length === 0"
    class="dynamic-cell__text"
  >{{ EMPTY_PLACEHOLDER }}</span>
  <UiChip
    v-else-if="kind === 'chip' && text.length > 0"
    :label="textLook.label"
    :token="textLook.token"
    :icon="textLook.icon"
  >
    <HighlightedText
      v-if="isMatch(textLook.label) || isMatch(text)"
      :text="textLook.label"
      :term="search"
      :stored="text"
    />
    <template v-else>
      {{ textLook.label }}
    </template>
  </UiChip>
  <!-- A truth value reads as the tick or the cross it is, which is quicker to scan than the word for it. -->
  <span
    v-else-if="kind === 'boolean'"
    class="dynamic-cell__text"
  >
    <v-icon
      v-if="isTrue !== null"
      size="small"
      :icon="isTrue ? 'mdi-check-circle-outline' : 'mdi-close-circle-outline'"
      :color="isTrue ? 'success' : 'app-muted'"
    />
    <template v-else>{{ EMPTY_PLACEHOLDER }}</template>
  </span>
  <!-- A status is stored as a key and read out as a label, so the pen is given both spellings of it. -->
  <UiChip
    v-else-if="kind === 'status' && text.length > 0"
    :label="statusLabel"
    :token="statusChipToken"
  >
    <HighlightedText
      v-if="isStatusMatch"
      :text="statusLabel"
      :term="search"
      :stored="text"
    />
    <template v-else>
      {{ statusLabel }}
    </template>
  </UiChip>
  <!-- A point is read as its numbers here; the tables that offer the map are the ones the grid renders. -->
  <span
    v-else-if="kind === 'coordinate'"
    class="dynamic-cell__text"
  >{{ coordinateLabel }}</span>
  <!-- A cell of one of the plain tables grows with what it holds, so the files may say where they came from. -->
  <FileList
    v-else-if="kind === 'files'"
    :files="artifacts"
    :flat="isFlat"
    show-upload
    @open="emit('open', $event)"
    @download="emit('download', $event)"
  />
  <!--
    A moment the system recorded rather than one anybody chose. It is worth having and rarely what the row was
    opened for, so it stands at the end of its column, quieter than the values beside it. A date is written in
    digits whichever language the page is read in, so it is always laid out left to right - a Hebrew table
    would otherwise turn "16/09/26, 15:39" into "15:39 ,16/09/26".
  -->
  <span
    v-else-if="kind === 'date' && isStamp"
    class="dynamic-cell__stamp"
    dir="ltr"
  >
    {{ dateLabel }}
  </span>
  <span
    v-else-if="kind === 'date'"
    class="dynamic-cell__text"
    dir="ltr"
  >{{ dateLabel }}</span>
  <!--
    Anything else is read as text, and an address inside that text is read as an address. A field declared as
    a string is where a ticket, a dashboard or a wiki page actually gets written down, and showing one as
    characters left the one thing a reader wanted to do with the value as the one thing it would not do.
  -->
  <span
    v-else
    class="dynamic-cell__text"
    :dir="valueDirection(text)"
  ><UiLinkedText
    v-if="text.length > 0"
    :text="text"
    :term="isMatch(text) ? search : ''"
  /><template v-else>{{ EMPTY_PLACEHOLDER }}</template></span>
</template>

<script lang="ts">
import type { Artifact } from '../models/common'
import {
  EMPTY_PLACEHOLDER,
  UiChip,
  formatCompactDateTime,
  formatDate,
  formatDateTime,
} from '../index'
import type { GeneratedColumn, GridRow } from '../models/grid'
import type { TaxonomyItem } from '../models/common'

interface Props {
  column: GeneratedColumn
  row: GridRow
  taxonomy?: TaxonomyItem[]
  /*
   * Which colour a status of this product is painted in. What a status means is the product's own business,
   * so the mapping is handed in; a cell with nothing handed to it colours the value by its own name.
   */
  tokenFor?: (value: string, palette: string | undefined) => string
}

interface Emits {
  (event: 'open', artifact: Artifact): void
  (event: 'download', artifact: Artifact): void
}

type CellKind = 'chip' | 'chips' | 'status' | 'files' | 'date' | 'coordinate' | 'boolean' | 'text'
</script>

<script setup lang="ts">
import { computed } from 'vue'

import FileList from './FileList.vue'
import HighlightedText from './HighlightedText.vue'
import UiLinkedText from './UiLinkedText.vue'
import { language } from '../composables/useLanguage'
import { valueDirection } from '../utils/bidi'
import { chipLook, type ChipLook } from '../utils/chips'
import { valueLabel } from '../utils/names'
import { hashedToken } from '../utils/palette'
import { formatCoordinate, toCoordinate } from '../utils/coordinates'
import { useSearchTerm } from '../utils/grid-context'
import { matchesTerm } from '../utils/highlight'
import { readArtifacts, readPath, readText } from '../utils/rows'

const props = withDefaults(defineProps<Props>(), { taxonomy: () => [], tokenFor: (value: string) => hashedToken(value) })
const emit = defineEmits<Emits>()

/*
 * Whatever the surface around this cell was searched for, which is nothing at all on the event page: the
 * same cell renders there and has no table above it that anybody searched.
 */
const search = useSearchTerm()

const kind = computed<CellKind>(() => {
  switch (props.column.cellRenderer) {
    case 'ChipCellRenderer':
      return 'chip'
    case 'ChipListCellRenderer':
      return 'chips'
    case 'CoordinateCellRenderer':
      return 'coordinate'
    case 'BooleanCellRenderer':
      return 'boolean'
    case 'StatusCellRenderer':
      return 'status'
    case 'FilesCellRenderer':
      return 'files'
    case 'DateCellRenderer':
      return 'date'
    default:
      return 'text'
  }
})

const text = computed<string>(() => readText(props.row, props.column.field))

/*
 * Whether this cell is a bookkeeping stamp - created at, updated at - rather than a moment anybody chose.
 * The column says which it is, so the table and the panels underneath it read it exactly the same way.
 */
const isStamp = computed<boolean>(() => props.column.cellRendererParams.stamp === true)

/* A column that already names one half of the files of a row draws them as a plain list, not as folders. */
const isFlat = computed<boolean>(() => props.column.cellRendererParams.flat === true)

/*
 * The same column definition drives the grid and this cell, so a moment carries its clock in both - and a
 * stamp is written the short way, because the whole point of it is to take as little of the row as it can.
 */
const formatMoment = (moment: string): string => {
  if (props.column.cellRendererParams.withTime !== true) {
    return formatDate(moment)
  }

  return isStamp.value ? formatCompactDateTime(moment) : formatDateTime(moment)
}

/* A field declared as a list of dates holds several moments, and each of them is written out on its own. */
const dateLabel = computed<string>(() => {
  const value = readPath(props.row, props.column.field)

  return Array.isArray(value)
    ? value.map((item) => formatMoment(String(item))).join(', ')
    : formatMoment(text.value)
})
const artifacts = computed<Artifact[]>(() => readArtifacts(readPath(props.row, props.column.field)))

/* The items of a list valued cell, read out of the value itself rather than off the flattened text. */
const items = computed<string[]>(() => {
  const value = readPath(props.row, props.column.field)

  if (Array.isArray(value)) {
    return value.filter((item) => item !== null && item !== '').map((item) => String(item))
  }

  return text.value.length > 0 ? [text.value] : []
})

/* Which of the three a truth valued cell is in: true, false, or never filled in at all. */
const isTrue = computed<boolean | null>(() => {
  const value = readPath(props.row, props.column.field)

  return value === null || value === undefined || value === '' ? null : value === true || value === 'true'
})

const coordinateLabel = computed<string>(() => {
  const point = toCoordinate(readPath(props.row, props.column.field))

  return point === null ? EMPTY_PLACEHOLDER : formatCoordinate(point)
})

const palette = computed<string | undefined>(() => {
  const named = props.column.cellRendererParams.palette

  return typeof named === 'string' ? named : undefined
})

/** How a value of this column is drawn, under the name its vocabulary gives it in the language of the page. */
const lookOf = (value: string): ChipLook => {
  void language.value

  return chipLook(value, palette.value, props.column.filterOptions, props.taxonomy)
}

const textLook = computed<ChipLook>(() => lookOf(text.value))

const itemLooks = computed<(ChipLook & { value: string })[]>(() =>
  items.value.map((value) => ({ value, ...lookOf(value) })),
)

const statusLabel = computed<string>(() => {
  void language.value

  return valueLabel(text.value)
})

const statusChipToken = computed<string>(() => props.tokenFor(text.value, palette.value))

const isMatch = (value: string): boolean => matchesTerm(value, search.value)

const isStatusMatch = computed<boolean>(() => isMatch(statusLabel.value) || isMatch(text.value))
</script>

<style scoped>
.dynamic-cell__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  min-inline-size: 0;
}

.dynamic-cell__text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * A stamp reads at the end of its column, in digits of one width so that a column of them lines up, and one
 * step quieter than everything beside it - which is exactly how much attention it deserves.
 */
.dynamic-cell__stamp {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.65;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
