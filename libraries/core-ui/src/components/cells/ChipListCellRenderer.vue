<template>
  <span class="chip-list">
    <template v-if="values.length > 0">
      <span
        v-if="isPlain"
        class="chip-list__plain"
        :class="{ 'chip-list__plain--expandable': isExpandable }"
        @click="openViewer"
      >
        <HighlightedText
          v-if="isMatch(joined)"
          :text="joined"
          :term="search"
        />
        <template v-else>{{ joined }}</template>
      </span>
      <!-- The marker pen goes inside a chip rather than behind it, so that it says which characters matched. -->
      <template v-else>
        <UiChip
          v-for="look in looks"
          :key="look.value"
          :label="look.label"
          :token="look.token"
          :icon="look.icon"
        >
          <HighlightedText
            v-if="isMatch(look.label) || isMatch(look.value)"
            :text="look.label"
            :term="search"
            :stored="look.value"
          />
          <template v-else>
            {{ look.label }}
          </template>
        </UiChip>
      </template>
    </template>
    <span
      v-else
      class="chip-list__empty"
    >{{ EMPTY_PLACEHOLDER }}</span>

    <!--
      A list longer than the column is wide has to be readable somewhere, and a tooltip is not that place.
      A list the search reached into shows its way in without being hovered first, because what the column
      cuts off is exactly where the reader cannot see whether more of the term is waiting.
    -->
    <button
      v-if="isExpandable"
      type="button"
      class="chip-list__expand"
      :class="{ 'chip-list__expand--matched': mayHideMatch }"
      :aria-label="t('value.readFull', { name: headerName })"
      @click.stop="dialog = true"
    >
      <v-icon
        icon="mdi-arrow-expand"
        size="x-small"
      />
    </button>

    <ValueViewerDialog
      v-if="isExpandable"
      v-model="dialog"
      :value="bullets"
      :title="headerName"
    />
  </span>
</template>

<script lang="ts">
import type { ICellRendererParams } from 'ag-grid-community'
import { EMPTY_PLACEHOLDER, UiChip, UiValueViewer as ValueViewerDialog } from '../../index'
import type { GridRow } from '../../models/grid'

interface Props {
  params: ICellRendererParams<GridRow> & { variant?: string; palette?: string }
}

/** One value of the list as it is drawn, beside the value it was stored as. */
interface ValueLook extends ChipLook {
  value: string
}

/** Past this much text the cell is showing a fragment of the list however the list is laid out. */
const TEXT_LIMIT = 48

/** Even short labels stop fitting once there are this many of them side by side. */
const VISIBLE_LIMIT = 3
</script>

<script setup lang="ts">
import { useLanguage } from '../../composables/useLanguage'

import { computed, ref } from 'vue'

import HighlightedText from '../../components/HighlightedText.vue'
import { language } from '../../composables/useLanguage'
import { chipLook, readColumnOptions, type ChipLook } from '../../utils/chips'
import { readContext } from '../../utils/grid-context'
import { matchesTerm } from '../../utils/highlight'
import { toBulletedText } from '../../utils/notes'

const { t } = useLanguage()

const props = defineProps<Props>()

const dialog = ref<boolean>(false)

const isPlain = computed<boolean>(() => props.params.variant === 'plain')

const values = computed<string[]>(() => {
  const value = props.params.value
  if (Array.isArray(value)) {
    return value.map((item) => String(item))
  }

  return value === null || value === undefined || value === '' ? [] : [String(value)]
})

/* Each value under the name its vocabulary gives it, in the language of the page. */
const looks = computed<ValueLook[]>(() => {
  void language.value
  const options = readColumnOptions(props.params.colDef?.filterParams)
  const taxonomy = readContext(props.params).taxonomy

  return values.value.map((value) => ({ value, ...chipLook(value, props.params.palette, options, taxonomy) }))
})

const joined = computed<string>(() => looks.value.map((look) => look.label).join(', '))

const isExpandable = computed<boolean>(
  () => joined.value.length > TEXT_LIMIT || values.value.length > VISIBLE_LIMIT,
)

const bullets = computed<string>(() => toBulletedText(looks.value.map((look) => look.label)))

const search = computed<string>(() => readContext(props.params).search)

const headerName = computed<string>(() => props.params.colDef?.headerName ?? t('value.title'))

const isMatch = (value: string): boolean => matchesTerm(value, search.value)

/*
 * Whether the list holds matched text the column has no room for. A list is laid out to the width of the
 * cell and cut off by it rather than by a character count, so a cell cannot tell where the reader stops
 * seeing it - which is why the way to the whole list opens up as soon as anything in it matched.
 */
const mayHideMatch = computed<boolean>(() => isExpandable.value && isMatch(joined.value))

/**
 * Open the viewer from the text itself, which is where a reader who already sees the list cut off reaches
 * first. The row underneath must not act on that click, or reading a value would expand the event.
 */
const openViewer = (event: MouseEvent) => {
  if (!isExpandable.value) {
    return
  }

  event.stopPropagation()
  dialog.value = true
}
</script>

<style>
.chip-list {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-inline-size: 0;
}

.chip-list__plain {
  flex: 1 1 auto;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chip-list__plain--expandable {
  cursor: pointer;
}

.chip-list__plain--expandable:hover {
  text-decoration: underline;
}

.chip-list__empty {
  opacity: 0.6;
}

.chip-list__expand {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  border: none;
  background: none;
  padding: 0;
  color: inherit;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease-in-out;
}

/*
 * The affordance stays out of the way until the cell is under the pointer, so that a table of lists is not a
 * wall of icons. A keyboard never hovers, which is why focus reveals it just as hovering does.
 */
.chip-list:hover .chip-list__expand,
.chip-list__expand:focus-visible {
  opacity: 0.75;
}

.chip-list__expand:hover {
  opacity: 1;
}

/* A list the search reached into is worth opening, so its way in is on screen rather than under the pointer. */
.chip-list__expand--matched {
  opacity: 1;
  color: rgb(var(--v-theme-warning));
}
</style>
