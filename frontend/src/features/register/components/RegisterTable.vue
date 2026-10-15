<template>
  <div ref="frame" class="table-frame surface" :style="{ '--frame-width': `${frameWidth}px` }">
    <table class="table" :aria-busy="loading">
      <colgroup>
        <col class="col-expand">
        <col v-for="column in columns" :key="column.id" :class="{ 'col-pinned': column.pinned }" :style="{ inlineSize: `${column.width}px`, minInlineSize: `${column.width}px` }">
      </colgroup>

      <thead>
        <tr>
          <th class="th th--expand sticky-start" scope="col" />
          <th
            v-for="column in columns"
            :key="column.id"
            class="th"
            :class="{ 'sticky-pinned': column.pinned, 'th--number': column.cell === 'number' }"
            scope="col"
            :aria-sort="ariaSort(column.id)"
          >
            <div class="th__inner">
              <button
                v-if="column.sortable"
                type="button"
                class="th__label"
                :title="t('register.sortHint')"
                @click="emit('sort', column.id, $event.shiftKey)"
              >
                <span class="bidi">{{ column.label }}</span>
                <span v-if="sortOf(column.id)" class="th__sort">
                  <v-icon :icon="sortOf(column.id)?.direction === 'asc' ? 'mdi-arrow-up' : 'mdi-arrow-down'" size="13" />
                  <sup v-if="sort.length > 1">{{ sortIndex(column.id) }}</sup>
                </span>
              </button>
              <span v-else class="th__label bidi">{{ column.label }}</span>
              <ColumnFilterMenu
                :column="column"
                :conditions="filters.filter((condition) => condition.key === column.id)"
                :source="source"
                @apply="emit('filter', column.id, $event)"
              />
            </div>
          </th>
        </tr>
      </thead>

      <tbody v-if="loading && rows.length === 0">
        <tr v-for="index in 8" :key="index" class="tr tr--skeleton">
          <td class="td sticky-start" />
          <td v-for="column in columns" :key="column.id" class="td" :class="{ 'sticky-pinned': column.pinned }">
            <div class="skeleton" :style="{ inlineSize: `${40 + ((index * 17 + column.width) % 50)}%` }" />
          </td>
        </tr>
      </tbody>

      <tbody v-else>
        <template v-for="row in rows" :key="row.id">
          <tr
            class="tr"
            :class="{ 'tr--expanded': expanded.has(row.id), 'tr--pending': !row.complete }"
            @click="onRowClick(row.id, $event)"
          >
            <td class="td td--expand sticky-start">
              <button
                type="button"
                class="expander"
                :aria-expanded="expanded.has(row.id)"
                :aria-label="expanded.has(row.id) ? t('register.collapse') : t('register.expand')"
                @click.stop="emit('toggle', row.id)"
              >
                <v-icon icon="mdi-chevron-down" size="18" />
              </button>
            </td>
            <td v-for="column in columns" :key="column.id" class="td" :class="{ 'sticky-pinned': column.pinned }">
              <TableCell :row="row" :column="column" :search="search" />
            </td>
          </tr>
          <tr v-if="expanded.has(row.id)" class="tr-detail">
            <td :colspan="columns.length + 1" class="td-detail">
              <div class="td-detail__inner">
                <slot name="detail" :row="row" />
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import type { RowSource } from '@/domain/register/row-source'
import type { ColumnDef, FilterCondition, RegisterRow, SortSpec } from '@/domain/register/types'
import { useI18n } from '@/i18n'

import ColumnFilterMenu from './ColumnFilterMenu.vue'
import TableCell from './TableCell.vue'

const props = defineProps<{
  rows: RegisterRow[]
  columns: ColumnDef[]
  sort: SortSpec[]
  filters: FilterCondition[]
  expanded: Set<string>
  search: string
  source: RowSource
  loading: boolean
}>()

const emit = defineEmits<{
  sort: [columnId: string, additive: boolean]
  filter: [columnId: string, condition: FilterCondition | null]
  toggle: [rowId: string]
}>()

const { t } = useI18n()

const frame = ref<HTMLElement | null>(null)
const frameWidth = ref(0)
let observer: ResizeObserver | null = null

/* The detail panel stays the width of the visible frame however far the table is scrolled sideways. */
onMounted(() => {
  if (frame.value === null || typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([entry]) => {
    frameWidth.value = entry?.contentRect.width ?? 0
  })
  observer.observe(frame.value)
})
onBeforeUnmount(() => observer?.disconnect())

const sortOf = (id: string) => props.sort.find((item) => item.key === id)
const sortIndex = (id: string) => props.sort.findIndex((item) => item.key === id) + 1
const ariaSort = (id: string) => {
  const held = sortOf(id)

  return held === undefined ? 'none' : held.direction === 'asc' ? 'ascending' : 'descending'
}

/** A click on the row (but not on a link, button or selected text) toggles its details. */
const onRowClick = (rowId: string, event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.closest('a, button, input') || (window.getSelection()?.toString() ?? '').length > 0) {
    return
  }
  emit('toggle', rowId)
}
</script>

<style scoped>
.table-frame {
  position: relative;
  overflow-x: auto;
  overflow-y: visible;
}

.table {
  inline-size: 100%;
  min-inline-size: max-content;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.col-expand {
  inline-size: 44px;
}

/* ---------- header ---------- */

.th {
  position: sticky;
  inset-block-start: 0;
  z-index: 2;
  padding: 0.65rem 0.75rem;
  background: rgb(var(--v-theme-header-row));
  border-block-end: 1px solid rgb(var(--v-theme-border));
  text-align: start;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-muted));
  white-space: nowrap;
}

.th:first-child {
  border-start-start-radius: var(--truth-radius);
}

.th:last-child {
  border-start-end-radius: var(--truth-radius);
}

.th__inner {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.th--number .th__inner {
  justify-content: flex-end;
}

.th__label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
}

button.th__label:hover {
  color: rgb(var(--v-theme-on-surface));
}

.th__sort {
  display: inline-flex;
  align-items: center;
  color: rgb(var(--v-theme-primary));
}

.th__sort sup {
  font-size: 0.6rem;
}

/* ---------- body ---------- */

.td {
  padding: 0.7rem 0.75rem;
  vertical-align: top;
  background: rgb(var(--v-theme-surface));
  border-block-end: 1px solid rgb(var(--v-theme-border));
}

.tr {
  cursor: pointer;
}

.tr:hover .td {
  background: rgb(var(--v-theme-row-hover));
}

.tr--expanded .td {
  background: rgb(var(--v-theme-row-selected));
  border-block-end-color: transparent;
}

.tr--pending .td {
  opacity: 0.75;
}

tbody tr:last-child .td {
  border-block-end: none;
}

.td--expand {
  padding-inline: 0.5rem;
}

.expander {
  display: grid;
  place-items: center;
  inline-size: 1.75rem;
  block-size: 1.75rem;
  border-radius: 8px;
  color: rgb(var(--v-theme-muted));
  transition: transform 0.2s ease, background-color 0.15s, color 0.15s;
}

.expander:hover {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

.expander[aria-expanded='true'] {
  transform: rotate(180deg);
  color: rgb(var(--v-theme-primary));
}

/* ---------- pinned columns ---------- */

.sticky-start {
  position: sticky;
  inset-inline-start: 0;
  z-index: 1;
}

.sticky-pinned {
  position: sticky;
  inset-inline-start: 44px;
  z-index: 1;
  box-shadow: inset -1px 0 0 rgb(var(--v-theme-border));
}

[dir='rtl'] .sticky-pinned {
  box-shadow: inset 1px 0 0 rgb(var(--v-theme-border));
}

.th.sticky-start,
.th.sticky-pinned {
  z-index: 3;
}

/* On a phone a pinned column would cover the whole screen, so nothing but the chevron stays put. */
@media (max-width: 600px) {
  .sticky-pinned {
    position: static;
  }

  .col-pinned {
    inline-size: 260px !important;
  }
}

/* ---------- detail row ---------- */

.td-detail {
  padding: 0;
}

.td-detail__inner {
  position: sticky;
  inset-inline-start: 0;
  inline-size: var(--frame-width);
  max-inline-size: 100%;
  min-inline-size: min(100%, 320px);
}

/* ---------- skeleton ---------- */

.tr--skeleton {
  cursor: default;
}

.skeleton {
  block-size: 0.75rem;
  margin-block: 0.35rem;
  border-radius: 6px;
  background: linear-gradient(90deg, rgb(var(--v-theme-surface-light)), rgb(var(--v-theme-surface-variant)), rgb(var(--v-theme-surface-light)));
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}
</style>
