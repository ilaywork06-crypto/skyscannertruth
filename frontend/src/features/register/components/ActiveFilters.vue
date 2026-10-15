<template>
  <div v-if="search.trim() || filters.length > 0" class="active">
    <span class="active__label">{{ t('register.activeFilters') }}</span>

    <span v-if="search.trim()" class="active__chip">
      <v-icon icon="mdi-magnify" size="14" />
      <span class="bidi">{{ t('register.searchChip', { term: search.trim() }) }}</span>
      <button type="button" class="active__remove" :aria-label="t('filter.remove')" @click="emit('clear-search')">
        <v-icon icon="mdi-close" size="13" />
      </button>
    </span>

    <span v-for="(condition, index) in filters" :key="`${condition.key}-${index}`" class="active__chip">
      <strong class="bidi">{{ labelOf(condition.key) }}</strong>
      <span class="active__op">{{ operatorText(condition) }}</span>
      <span v-if="valueText(condition)" class="active__value bidi">{{ valueText(condition) }}</span>
      <button type="button" class="active__remove" :aria-label="t('filter.remove')" @click="emit('remove', index)">
        <v-icon icon="mdi-close" size="13" />
      </button>
    </span>

    <v-btn variant="text" size="small" color="primary" @click="emit('clear')">{{ t('register.clearFilters') }}</v-btn>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef, FilterCondition } from '@/domain/register/types'
import { EMPTINESS_OPERATORS } from '@/domain/register/types'
import { useI18n } from '@/i18n'
import { formatDate } from '@/shared/utils/format'

const props = defineProps<{ search: string; filters: FilterCondition[]; columns: ColumnDef[] }>()
const emit = defineEmits<{ remove: [index: number]; clear: []; 'clear-search': [] }>()

const { t } = useI18n()

const columnOf = (key: string) => props.columns.find((column) => column.id === key)
const labelOf = (key: string) => columnOf(key)?.label ?? key

const operatorText = (condition: FilterCondition): string => {
  const dated = `operator.date.${condition.operator}`
  if (columnOf(condition.key)?.filter === 'date' && t(dated) !== dated) return t(dated)

  return t(`operator.${condition.operator}`)
}

const show = (key: string, value: unknown): string =>
  columnOf(key)?.filter === 'date' ? formatDate(String(value)) : String(value ?? '')

const valueText = (condition: FilterCondition): string => {
  if (EMPTINESS_OPERATORS.has(condition.operator)) return ''
  if (condition.operator === 'between') return condition.values.map((value) => show(condition.key, value)).join(' – ')
  if (condition.values.length > 0) return condition.values.map(String).join(', ')

  return show(condition.key, condition.value)
}
</script>

<style scoped>
.active {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.active__label {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--v-theme-muted));
}

.active__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-inline-size: 28rem;
  padding: 0.25rem 0.3rem 0.25rem 0.65rem;
  border-radius: 8px;
  background: rgba(var(--v-theme-primary), 0.1);
  border: 1px solid rgba(var(--v-theme-primary), 0.25);
  font-size: 0.8rem;
}

.active__op {
  color: rgb(var(--v-theme-muted));
}

.active__value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active__remove {
  display: grid;
  place-items: center;
  inline-size: 1.25rem;
  block-size: 1.25rem;
  border-radius: 5px;
  color: rgb(var(--v-theme-muted));
}

.active__remove:hover {
  background: rgba(var(--v-theme-primary), 0.18);
  color: rgb(var(--v-theme-primary));
}
</style>
