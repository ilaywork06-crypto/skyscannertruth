<template>
  <v-menu v-model="open" :close-on-content-click="false" location="bottom start" offset="6">
    <template #activator="{ props: activator }">
      <button
        v-bind="activator"
        type="button"
        class="filter-trigger"
        :class="{ 'filter-trigger--active': active }"
        :aria-label="t('register.filterColumn', { column: column.label })"
        @click.stop
      >
        <v-icon :icon="active ? 'mdi-filter' : 'mdi-filter-outline'" size="15" />
      </button>
    </template>

    <v-card class="filter-card" width="300">
      <div class="filter-card__head">
        <span class="filter-card__title bidi">{{ t('filter.title', { column: column.label }) }}</span>
      </div>

      <div class="filter-card__body">
        <v-select
          v-model="operator"
          :items="operatorItems"
          :label="t('filter.operator')"
          density="compact"
        />

        <template v-if="!takesNoValue">
          <!-- A set filter picks from what the rows actually hold. -->
          <template v-if="isList">
            <v-text-field
              v-model="optionSearch"
              :placeholder="t('filter.searchValues')"
              prepend-inner-icon="mdi-magnify"
              density="compact"
              clearable
            />
            <div class="filter-card__options">
              <v-progress-linear v-if="loadingOptions" indeterminate color="primary" />
              <p v-else-if="shownOptions.length === 0" class="filter-card__none">{{ t('filter.noValues') }}</p>
              <v-checkbox
                v-for="option in shownOptions"
                :key="option"
                v-model="picked"
                :value="option"
                class="filter-card__option"
              >
                <template #label><span class="bidi">{{ option }}</span></template>
              </v-checkbox>
            </div>
          </template>

          <div v-else-if="operator === 'between'" class="filter-card__range">
            <v-text-field v-model="low" :type="inputType" :label="t('filter.from')" density="compact" dir="ltr" />
            <v-text-field v-model="high" :type="inputType" :label="t('filter.to')" density="compact" dir="ltr" />
          </div>

          <v-text-field
            v-else
            v-model="single"
            :type="inputType"
            :label="t('filter.value')"
            density="compact"
            :dir="column.filter === 'text' ? 'auto' : 'ltr'"
            autofocus
            @keydown.enter="apply"
          />
        </template>
      </div>

      <div class="filter-card__foot">
        <v-btn variant="text" size="small" :disabled="!active" @click="clear">{{ t('common.clear') }}</v-btn>
        <v-spacer />
        <v-btn color="primary" size="small" :disabled="!canApply" @click="apply">{{ t('common.apply') }}</v-btn>
      </div>
    </v-card>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { RowSource } from '@/domain/register/row-source'
import type { ColumnDef, FilterCondition, FilterOperator } from '@/domain/register/types'
import { EMPTINESS_OPERATORS, LIST_OPERATORS, OPERATORS_BY_FILTER } from '@/domain/register/types'
import { useI18n } from '@/i18n'

const props = defineProps<{ column: ColumnDef; conditions: FilterCondition[]; source: RowSource }>()
const emit = defineEmits<{ apply: [condition: FilterCondition | null] }>()

const { t } = useI18n()

const open = ref(false)
const operator = ref<FilterOperator>('in')
const single = ref('')
const low = ref('')
const high = ref('')
const picked = ref<string[]>([])
const options = ref<string[]>([])
const optionSearch = ref('')
const loadingOptions = ref(false)

const active = computed(() => props.conditions.length > 0)
const isList = computed(() => LIST_OPERATORS.has(operator.value))
const takesNoValue = computed(() => EMPTINESS_OPERATORS.has(operator.value))
const inputType = computed(() => (props.column.filter === 'number' ? 'number' : props.column.filter === 'date' ? 'date' : 'text'))

const operatorLabel = (op: FilterOperator): string => {
  const dated = `operator.date.${op}`
  if (props.column.filter === 'date' && t(dated) !== dated) {
    return t(dated)
  }

  return t(`operator.${op}`)
}

const operatorItems = computed(() =>
  OPERATORS_BY_FILTER[props.column.filter].map((op) => ({ value: op, title: operatorLabel(op) })),
)

const shownOptions = computed(() => {
  const needle = (optionSearch.value ?? '').trim().toLowerCase()

  return needle.length === 0 ? options.value : options.value.filter((option) => option.toLowerCase().includes(needle))
})

const canApply = computed(() => {
  if (takesNoValue.value) return true
  if (isList.value) return picked.value.length > 0
  if (operator.value === 'between') return low.value !== '' && high.value !== ''

  return String(single.value ?? '').trim().length > 0
})

/** Load the draft from the column's current condition each time the menu opens. */
watch(open, async (isOpen) => {
  if (!isOpen) return

  const current = props.conditions[0]
  const offered = OPERATORS_BY_FILTER[props.column.filter]
  operator.value = current?.operator ?? offered[0] ?? 'contains'
  single.value = current === undefined ? '' : String(current.value ?? '')
  low.value = String(current?.values[0] ?? '')
  high.value = String(current?.values[1] ?? '')
  picked.value = current !== undefined && LIST_OPERATORS.has(current.operator) ? current.values.map(String) : []
  optionSearch.value = ''

  if (props.column.filter === 'set') {
    loadingOptions.value = true
    options.value = await props.source.readOptions(props.column.id)
    loadingOptions.value = false
  }
})

const apply = () => {
  if (!canApply.value) return
  const key = props.column.id
  const condition: FilterCondition = takesNoValue.value
    ? { key, operator: operator.value, value: null, values: [] }
    : isList.value
      ? { key, operator: operator.value, value: null, values: [...picked.value] }
      : operator.value === 'between'
        ? { key, operator: operator.value, value: null, values: [low.value, high.value] }
        : { key, operator: operator.value, value: String(single.value).trim(), values: [] }
  emit('apply', condition)
  open.value = false
}

const clear = () => {
  emit('apply', null)
  open.value = false
}
</script>

<style scoped>
.filter-trigger {
  display: grid;
  place-items: center;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  border-radius: 6px;
  color: rgb(var(--v-theme-muted));
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s;
}

:global(.th:hover) .filter-trigger,
.filter-trigger:focus-visible,
.filter-trigger[aria-expanded='true'] {
  opacity: 1;
}

.filter-trigger:hover {
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

.filter-trigger--active {
  opacity: 1;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.14);
}

.filter-card__head {
  padding: 0.9rem 1rem 0.25rem;
}

.filter-card__title {
  font-size: 0.875rem;
  font-weight: 600;
}

.filter-card__body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.6rem 1rem;
}

.filter-card__options {
  max-block-size: 15rem;
  overflow-y: auto;
  margin-inline: -0.25rem;
}

.filter-card__option :deep(.v-label) {
  font-size: 0.8125rem;
  opacity: 1;
}

.filter-card__none {
  padding: 0.5rem;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}

.filter-card__range {
  display: flex;
  gap: 0.5rem;
}

.filter-card__foot {
  display: flex;
  align-items: center;
  padding: 0.6rem 0.75rem;
  border-top: 1px solid rgb(var(--v-theme-border));
}
</style>
