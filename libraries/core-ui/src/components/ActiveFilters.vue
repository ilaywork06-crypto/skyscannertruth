<template>
  <!--
    A filtered table that does not say so reads as a table with missing rows. Every restriction currently
    narrowing the view is therefore named here, and every one of them can be lifted from the same place.
  -->
  <div
    v-if="chips.length > 0"
    class="active-filters"
  >
    <span class="active-filters__label">{{ t('filters.activeLabel') }}</span>

    <button
      v-for="chip in chips"
      :key="chip.id"
      type="button"
      class="active-filters__chip"
      :aria-label="t('filters.remove', { label: chip.label })"
      @click="emit('remove', chip)"
    >
      <span
        class="active-filters__chip-key"
        dir="auto"
      >{{ chip.field }}</span>
      <span
        class="active-filters__chip-value"
        dir="auto"
      >{{ chip.value }}</span>
      <v-icon
        size="x-small"
        icon="mdi-close"
      />
    </button>

    <v-btn
      class="active-filters__clear"
      variant="text"
      size="small"
      prepend-icon="mdi-filter-remove-outline"
      @click="emit('clear')"
    >
      {{ t('filters.clearAll') }}
    </v-btn>
  </div>
</template>

<script lang="ts">
import { humanizeKey } from '../index'
import type { GeneratedColumn } from '../models/grid'
import type { FilterCondition } from '../models/query'

/** What a single chip stands for, which decides what lifting it has to undo. */
type FilterKind = 'search' | 'scope' | 'column'

/**
 * A narrowing the product applies of its own accord, shown beside the column filters so that it can be lifted.
 *
 * An inventory narrows its rows to the ones that were parsed, an assumption register to the ones of an
 * industry; neither is a filter on a column, and both have to be visible or a user cannot tell why the table
 * is short. The product says what it is showing and this draws it.
 */
interface ScopeFilter {
  /** What the narrowing is called, which reads as the field name of the chip. */
  field: string
  /** What it is currently narrowed to. */
  value: string
}

interface FilterChip {
  id: string
  kind: FilterKind
  field: string
  value: string
  label: string
  colId: string
  /** Where the condition stands among the conditions handed in, since one key may carry several. */
  index: number
}

interface Props {
  search: string
  scope: ScopeFilter | null
  filters: FilterCondition[]
  columns: GeneratedColumn[]
  /** What the keys that are not columns of the table are called - a field of an entity, for instance. */
  fieldLabels?: Record<string, string>
}

interface Emits {
  (event: 'remove', chip: FilterChip): void
  (event: 'clear'): void
}

/*
 * How each operator reads is looked up rather than written here, because the same chip has to read as a
 * Hebrew sentence on a Hebrew page. An operator the dictionary has never heard of reads as its own name,
 * which is what keeps a chip legible when a service grows an operator this library has not been told about.
 */
const operatorLabel = (operator: string): string => translate(`operator.${operator}`)

export type { FilterChip, ScopeFilter }
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { translate, useLanguage } from '../composables/useLanguage'
import { isolate, joinIsolated } from '../utils/bidi'
import { localLabel } from '../utils/names'


const props = withDefaults(defineProps<Props>(), { fieldLabels: () => ({}) })
const emit = defineEmits<Emits>()

const { t, language } = useLanguage()

/**
 * Read the header a column carries, so a chip names the field the way the table does.
 */
const headerOf = (key: string): string => {
  const named = props.fieldLabels[key]
  if (named !== undefined && named.length > 0) {
    return named
  }

  const column = props.columns.find((candidate) => candidate.colId === key)

  return column === undefined || column.headerName.length === 0 ? humanizeKey(key) : column.headerName
}

/**
 * Read one value under the name the vocabulary of its column gives it, in the language of the page.
 */
const labelOf = (key: string, value: string): string => {
  const column = props.columns.find((candidate) => candidate.colId === key)
  const option = column?.filterOptions.find((candidate) => candidate.value === value)

  return option === undefined ? value : localLabel(option.label, option.labelHebrew)
}

/**
 * Render the value of one condition, joining the list operators back into readable text.
 */
const valueOf = (condition: FilterCondition): string => {
  const operator = operatorLabel(condition.operator)
  if (condition.operator === 'is_empty' || condition.operator === 'is_not_empty') {
    return operator
  }

  /* The values are somebody's words in either language, so each is fenced off from the operator and the others. */
  const rendered =
    condition.values.length > 0
      ? joinIsolated(condition.values.map((value) => labelOf(condition.key, String(value))))
      : isolate(labelOf(condition.key, String(condition.value ?? '')))

  return condition.operator === 'equals' ? rendered : `${operator} ${rendered}`
}

const chips = computed<FilterChip[]>(() => {
  /* Named so the language is a dependency of this: every label below it is read out of the dictionary. */
  void language.value

  const collected: FilterChip[] = []

  if (props.search.length > 0) {
    collected.push({
      id: 'search',
      kind: 'search',
      field: t('filters.search'),
      value: props.search,
      label: `${t('filters.search')}: ${props.search}`,
      colId: '',
      index: -1,
    })
  }

  if (props.scope !== null) {
    collected.push({
      id: 'scope',
      kind: 'scope',
      field: props.scope.field,
      value: props.scope.value,
      label: `${props.scope.field}: ${props.scope.value}`,
      colId: '',
      index: -1,
    })
  }

  props.filters.forEach((condition, index) => {
    const field = headerOf(condition.key)
    const value = valueOf(condition)
    collected.push({
      id: `column:${condition.key}:${index}`,
      kind: 'column',
      field,
      value,
      label: `${field}: ${value}`,
      colId: condition.key,
      index,
    })
  })

  return collected
})
</script>

<style scoped>
.active-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding-block-end: 0.75rem;
}

.active-filters__label {
  font-size: 0.8125rem;
  opacity: 0.7;
}

.active-filters__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border: 0.0625rem solid rgba(var(--v-theme-primary), 0.45);
  border-radius: 999rem;
  background-color: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-on-surface));
  padding-inline: 0.75rem;
  padding-block: 0.25rem;
  font-size: 0.8125rem;
  cursor: pointer;
  max-inline-size: 22rem;
}

.active-filters__chip:hover {
  background-color: rgba(var(--v-theme-primary), 0.2);
}

.active-filters__chip-key {
  opacity: 0.75;
  white-space: nowrap;
}

.active-filters__chip-value {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-filters__clear.v-btn {
  letter-spacing: normal;
}
</style>
