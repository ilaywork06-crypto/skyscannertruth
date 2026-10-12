<template>
  <!--
    A filter on any field an event carries - its own, including the ones no column shows - or on the fields of
    the entities inside it. A condition on an entity matches an event that holds at least one entity answering
    every such condition at once.
  -->
  <v-dialog
    :model-value="modelValue"
    max-width="34rem"
    @update:model-value="close"
  >
    <v-card class="field-filter">
      <v-card-title class="field-filter__title">
        {{ t('fieldFilter.title') }}
      </v-card-title>

      <v-card-text class="field-filter__body">
        <v-btn-toggle
          v-model="scope"
          class="field-filter__scope"
          mandatory
          divided
          density="comfortable"
        >
          <v-btn value="event">
            {{ t('fieldFilter.event') }}
          </v-btn>
          <v-btn value="entity">
            {{ t('fieldFilter.entity') }}
          </v-btn>
        </v-btn-toggle>

        <v-autocomplete
          v-model="fieldKey"
          :items="fieldItems"
          item-title="title"
          item-value="value"
          :label="t('fieldFilter.field')"
          :no-data-text="t('fieldFilter.noFields')"
        />

        <v-select
          v-if="field !== null"
          v-model="operator"
          :items="operatorItems"
          item-title="title"
          item-value="value"
          :label="t('fieldFilter.condition')"
        />

        <template v-if="field !== null && needsValue">
          <v-select
            v-if="kind === 'options'"
            v-model="picked"
            :items="optionItems"
            item-title="title"
            item-value="value"
            :label="t('fieldFilter.values')"
            multiple
            chips
            closable-chips
          />
          <v-select
            v-else-if="kind === 'boolean'"
            v-model="flag"
            :items="booleanItems"
            item-title="title"
            item-value="value"
            :label="t('fieldFilter.value')"
          />
          <DateField
            v-else-if="kind === 'date'"
            v-model="text"
            :label="t('fieldFilter.value')"
          />
          <v-text-field
            v-else
            v-model="text"
            :type="kind === 'number' ? 'number' : 'text'"
            :label="t('fieldFilter.value')"
          />
        </template>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="close"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!canApply"
          @click="apply"
        >
          {{ t('fieldFilter.apply') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import type { FilterCondition, FilterOperator } from '@/models/query'
import type { GeneratedColumn, JsonValue } from '@truth-platform/core-ui'

type FilterScope = 'event' | 'entity'

/** How a field is asked about, which decides the conditions offered and the input the value is typed in. */
type FieldKind = 'options' | 'boolean' | 'number' | 'date' | 'text'

interface Props {
  modelValue: boolean
  /** Every column the inventory generates, the hidden ones included. */
  eventColumns: GeneratedColumn[]
  /** Every column the entity tables of the picked industries generate. */
  entityColumns: GeneratedColumn[]
}

interface AppliedFilter {
  condition: FilterCondition
  /** What the condition is called in the chips above the table. */
  label: string
}

interface Emits {
  (event: 'update:modelValue', open: boolean): void
  (event: 'apply', filter: AppliedFilter): void
}

interface Item<ValueT> {
  title: string
  value: ValueT
}

/** How the entities of an event are addressed, which the events service reads as one entity at a time. */
const ENTITY_PREFIX = 'objects.'

/** What a date filter sends, which the service reads as the whole of that day. */
const DAY_SUFFIX = ' 00:00:00'

const OPERATORS: Record<FieldKind, FilterOperator[]> = {
  options: ['in', 'not_in', 'is_empty', 'is_not_empty'],
  boolean: ['equals', 'is_empty'],
  number: ['equals', 'greater_than', 'greater_or_equal', 'less_than', 'less_or_equal', 'is_empty', 'is_not_empty'],
  date: ['equals', 'greater_or_equal', 'less_or_equal', 'is_empty', 'is_not_empty'],
  text: ['contains', 'equals', 'not_contains', 'starts_with', 'is_empty', 'is_not_empty'],
}

const NUMERIC_TYPES: string[] = ['number', 'integer']
const DATE_TYPES: string[] = ['date', 'datetime']

/**
 * Whether a column can be asked about here: it holds a value and says that it can be filtered.
 */
const isAskable = (column: GeneratedColumn): boolean =>
  column.headerName.length > 0 && column.filter !== false && column.fieldType !== 'file' && column.fieldType !== 'json'

export type { AppliedFilter }
</script>

<script setup lang="ts">
import { DateField, localLabel, translate, useLanguage } from '@truth-platform/core-ui'
import { computed, ref, watch } from 'vue'

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useLanguage()

const scope = ref<FilterScope>('event')
const fieldKey = ref<string | null>(null)
const operator = ref<FilterOperator>('contains')
const text = ref<string>('')
const picked = ref<string[]>([])
const flag = ref<boolean | null>(null)

const columns = computed<GeneratedColumn[]>(() =>
  (scope.value === 'event' ? props.eventColumns : props.entityColumns).filter(isAskable),
)

const fieldItems = computed<Item<string>[]>(() =>
  columns.value.map((column) => ({ title: column.headerName, value: column.colId })),
)

const field = computed<GeneratedColumn | null>(
  () => columns.value.find((column) => column.colId === fieldKey.value) ?? null,
)

const kind = computed<FieldKind>(() => {
  const column = field.value
  if (column === null) {
    return 'text'
  }
  if (column.filterOptions.length > 0) {
    return 'options'
  }
  if (column.fieldType === 'boolean') {
    return 'boolean'
  }
  if (NUMERIC_TYPES.includes(column.fieldType)) {
    return 'number'
  }

  return DATE_TYPES.includes(column.fieldType) ? 'date' : 'text'
})

const operatorItems = computed<Item<FilterOperator>[]>(() =>
  OPERATORS[kind.value].map((value) => ({ title: translate(`operator.${value}`), value })),
)

const optionItems = computed<Item<string>[]>(() =>
  (field.value?.filterOptions ?? []).map((option) => ({
    title: localLabel(option.label, option.labelHebrew),
    value: option.value,
  })),
)

const booleanItems = computed<Item<boolean>[]>(() => [
  { title: t('common.yes'), value: true },
  { title: t('common.no'), value: false },
])

const needsValue = computed<boolean>(() => operator.value !== 'is_empty' && operator.value !== 'is_not_empty')

const canApply = computed<boolean>(() => {
  if (field.value === null) {
    return false
  }
  if (!needsValue.value) {
    return true
  }
  if (kind.value === 'options') {
    return picked.value.length > 0
  }
  if (kind.value === 'boolean') {
    return flag.value !== null
  }

  return text.value.trim().length > 0
})

/* A new field starts from the first condition that suits it, with nothing typed yet. */
watch([field, scope], () => {
  operator.value = OPERATORS[kind.value][0]
  text.value = ''
  picked.value = []
  flag.value = null
})

watch(scope, () => {
  fieldKey.value = null
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      fieldKey.value = null
    }
  },
)

const close = () => {
  emit('update:modelValue', false)
}

/**
 * Read what was typed as the value the condition compares against.
 */
const readValue = (): JsonValue => {
  if (kind.value === 'boolean') {
    return flag.value
  }
  if (kind.value === 'number') {
    return Number(text.value)
  }
  if (kind.value === 'date') {
    return `${text.value}${DAY_SUFFIX}`
  }

  return text.value.trim()
}

const apply = () => {
  const column = field.value
  if (column === null || !canApply.value) {
    return
  }

  const key = scope.value === 'entity' ? `${ENTITY_PREFIX}${column.field}` : column.colId
  const listed = kind.value === 'options' && needsValue.value
  const condition: FilterCondition = {
    key,
    operator: operator.value,
    value: listed || !needsValue.value ? null : readValue(),
    values: listed ? [...picked.value] : [],
  }
  const prefix = scope.value === 'entity' ? `${t('fieldFilter.entity')} · ` : ''

  emit('apply', { condition, label: `${prefix}${column.headerName}` })
  emit('update:modelValue', false)
}
</script>

<style scoped>
.field-filter__title {
  font-size: 1.125rem;
  font-weight: 700;
}

.field-filter__body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field-filter__scope {
  align-self: flex-start;
}
</style>
