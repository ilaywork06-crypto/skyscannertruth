<script setup lang="ts">
/**
 * Filter by any field (spec §4.8): of the event or of its entities ("Telemetry"), with a condition fitting the
 * field's kind. Produces one condition (`objects.<field>` for an entity field) and the label of its chip.
 */
import { FilterIcon } from 'lucide-vue-next'
import { Button, Combobox, Dialog, Field, Input, Segmented, Select, cn, fieldClass, localLabel, translate as t } from '@truth-platform/ui'
import type { FilterCondition, FilterOperator, GeneratedColumn, JsonValue } from '@truth-platform/grid'
import { computed, ref, watch } from 'vue'

const props = defineProps<{ eventColumns: GeneratedColumn[]; entityColumns: GeneratedColumn[]; loading?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ apply: [condition: FilterCondition, label: string] }>()

type Scope = 'event' | 'entity'
type Kind = 'options' | 'boolean' | 'number' | 'date' | 'text'
const OPERATORS: Record<Kind, FilterOperator[]> = {
  options: ['in', 'not_in', 'is_empty', 'is_not_empty'],
  boolean: ['equals', 'is_empty'],
  number: ['equals', 'greater_than', 'greater_or_equal', 'less_than', 'less_or_equal', 'is_empty', 'is_not_empty'],
  date: ['equals', 'greater_or_equal', 'less_or_equal', 'is_empty', 'is_not_empty'],
  text: ['contains', 'equals', 'not_contains', 'starts_with', 'is_empty', 'is_not_empty'],
}

const scope = ref<Scope>('event')
const colId = ref<string | null>(null)
const operator = ref<FilterOperator>('contains')
const text = ref('')
const picked = ref<string[]>([])
const yes = ref<'true' | 'false' | null>(null)

const askable = (c: GeneratedColumn) => !!c.headerName && c.filter !== false && c.fieldType !== 'file' && c.fieldType !== 'json'
const columns = computed(() => (scope.value === 'event' ? props.eventColumns : props.entityColumns).filter(askable))
const column = computed(() => columns.value.find((c) => c.colId === colId.value) ?? null)
const kind = computed<Kind>(() => {
  const c = column.value
  if (!c) return 'text'
  if (c.filterOptions?.length) return 'options'
  if (c.fieldType === 'boolean') return 'boolean'
  if (c.fieldType === 'number' || c.fieldType === 'integer') return 'number'
  if (c.fieldType === 'date' || c.fieldType === 'datetime') return 'date'
  return 'text'
})
const needsValue = computed(() => operator.value !== 'is_empty' && operator.value !== 'is_not_empty')
const canApply = computed(() => {
  if (!column.value) return false
  if (!needsValue.value) return true
  if (kind.value === 'options') return picked.value.length > 0
  if (kind.value === 'boolean') return yes.value !== null
  return String(text.value ?? '').trim() !== ''
})

function resetValue() {
  operator.value = OPERATORS[kind.value][0]
  text.value = ''
  picked.value = []
  yes.value = null
}
watch(open, (o) => {
  if (o) {
    colId.value = null
    resetValue()
  }
})
watch(scope, () => {
  colId.value = null
  resetValue()
})
watch(colId, resetValue)

function apply() {
  const c = column.value
  if (!c || !canApply.value) return
  let value: JsonValue = null
  let values: JsonValue[] = []
  if (needsValue.value) {
    if (kind.value === 'options') values = [...picked.value]
    else if (kind.value === 'boolean') value = yes.value === 'true'
    else if (kind.value === 'number') value = Number(text.value)
    else if (kind.value === 'date') value = `${text.value} 00:00:00`
    else value = String(text.value).trim()
  }
  const key = scope.value === 'entity' ? `objects.${c.field}` : c.colId
  const label = scope.value === 'entity' ? `${t('fieldFilter.entity')} · ${c.headerName}` : c.headerName
  emit('apply', { key, operator: operator.value, value, values }, label)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open" size="md" :title="t('fieldFilter.title')">
    <template #icon><FilterIcon /></template>
    <div class="flex flex-col gap-4">
      <Segmented v-model="scope" :options="[{ value: 'event', label: t('fieldFilter.event') }, { value: 'entity', label: t('fieldFilter.entity') }]" class="self-start" />
      <Field :label="t('fieldFilter.field')" for="ff-field">
        <Combobox
          id="ff-field"
          v-model="colId"
          :options="columns.map((c) => ({ value: c.colId, label: c.headerName }))"
          :placeholder="t('fieldFilter.field')"
          :empty="t('fieldFilter.noFields')"
          :loading="loading"
        />
      </Field>
      <Field v-if="column" :label="t('fieldFilter.condition')" for="ff-op">
        <Select id="ff-op" v-model="operator" :options="OPERATORS[kind].map((o) => ({ value: o, label: t(`operator.${o}`) }))" />
      </Field>
      <template v-if="column && needsValue">
        <Field v-if="kind === 'options'" :label="t('fieldFilter.values')" for="ff-values">
          <Combobox
            id="ff-values"
            v-model="picked"
            multiple
            :options="column.filterOptions.map((o) => ({ value: o.value, label: localLabel(o.label, o.labelHebrew) }))"
            :placeholder="t('fieldFilter.values')"
          />
        </Field>
        <Field v-else-if="kind === 'boolean'" :label="t('fieldFilter.value')" for="ff-bool">
          <Select id="ff-bool" v-model="yes" :options="[{ value: 'true', label: t('common.yes') }, { value: 'false', label: t('common.no') }]" />
        </Field>
        <Field v-else-if="kind === 'date'" :label="t('fieldFilter.value')" for="ff-date">
          <input id="ff-date" v-model="text" type="date" :class="cn(fieldClass, 'h-9')" dir="ltr" />
        </Field>
        <Field v-else :label="t('fieldFilter.value')" for="ff-text">
          <Input id="ff-text" v-model="text" :type="kind === 'number' ? 'number' : 'text'" :dir="kind === 'number' ? 'ltr' : 'auto'" @keydown.enter="apply" />
        </Field>
      </template>
    </div>
    <template #footer>
      <Button variant="ghost" @click="open = false">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :disabled="!canApply" @click="apply">{{ t('fieldFilter.apply') }}</Button>
    </template>
  </Dialog>
</template>
