<template>
  <div class="cell" :class="`cell--${column.cell}`">
    <template v-if="isEmpty">
      <span class="cell__empty">—</span>
    </template>

    <HighlightedText v-else-if="column.cell === 'longtext'" class="cell__long" :text="text" :term="search" />

    <HighlightedText v-else-if="column.cell === 'text'" class="cell__text" :text="text" :term="search" />

    <ValueChip v-else-if="column.cell === 'chip'" :label="text" :neutral="column.palette === 'neutral'" :variant="column.palette === 'neutral' ? 'dot' : 'soft'" />

    <div v-else-if="column.cell === 'chips'" class="cell__chips">
      <ValueChip
        v-for="item in list"
        :key="item"
        :label="item"
        :variant="column.palette === 'neutral' ? 'dot' : 'soft'"
      />
    </div>

    <span v-else-if="column.cell === 'number'" class="cell__number tabular" dir="ltr">{{ formatValue(value) }}</span>

    <span v-else-if="column.cell === 'date'" class="tabular">{{ formatDate(text) }}</span>

    <span v-else-if="column.cell === 'datetime'" class="cell__stamp tabular" :title="formatDateTime(text)">
      {{ formatDate(text) }}
      <span class="cell__relative">{{ formatRelative(text) }}</span>
    </span>

    <span v-else-if="column.cell === 'boolean'" class="cell__bool" :class="{ 'cell__bool--on': value === true }">
      <v-icon :icon="value === true ? 'mdi-check-circle' : 'mdi-close-circle-outline'" size="16" />
      {{ value === true ? t('common.yes') : t('common.no') }}
    </span>

    <code v-else class="cell__json" dir="ltr">{{ formatValue(value) }}</code>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { isFilled, readPath, toText } from '@/domain/json'
import type { ColumnDef, RegisterRow } from '@/domain/register/types'
import { useI18n } from '@/i18n'
import ValueChip from '@/shared/components/ValueChip.vue'
import { formatDate, formatDateTime, formatRelative, formatValue } from '@/shared/utils/format'

import HighlightedText from './HighlightedText.vue'

const props = defineProps<{ row: RegisterRow; column: ColumnDef; search: string }>()

const { t } = useI18n()

const value = computed(() => readPath(props.row, props.column.field))
const isEmpty = computed(() => !isFilled(value.value) && value.value !== false)
const text = computed(() => toText(value.value))
const list = computed(() => (Array.isArray(value.value) ? value.value.map((item) => toText(item)) : [text.value]))
</script>

<style scoped>
.cell {
  display: flex;
  align-items: flex-start;
  min-inline-size: 0;
  font-size: 0.875rem;
  line-height: 1.45;
}

.cell__empty {
  color: rgb(var(--v-theme-muted));
  opacity: 0.6;
}

.cell__long {
  font-weight: 500;
  white-space: pre-line;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cell__text {
  overflow-wrap: anywhere;
}

.cell__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.cell__number {
  inline-size: 100%;
  text-align: end;
}

.cell__stamp {
  display: flex;
  flex-direction: column;
}

.cell__relative {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-muted));
}

.cell__bool {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: rgb(var(--v-theme-muted));
}

.cell__bool--on {
  color: rgb(var(--v-theme-success));
}

.cell__json {
  max-inline-size: 100%;
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface-light));
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
