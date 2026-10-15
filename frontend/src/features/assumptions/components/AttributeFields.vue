<template>
  <div class="attributes">
    <div v-for="field in fields" :key="field.key" class="attribute" :class="{ 'attribute--wide': field.type === 'multi_field' }">
      <FieldLabel
        :text="fieldLabel(field, language)"
        :html-for="`attr-${field.key}`"
        :required="field.required"
        :hint="hintFor(field)"
      />

      <v-select
        v-if="hasOptions(field.type)"
        :id="`attr-${field.key}`"
        :model-value="field.array ? asList(values[field.key]) : asChoice(values[field.key])"
        :items="field.options"
        :multiple="field.array"
        :chips="field.array"
        :closable-chips="field.array"
        :placeholder="t('form.select')"
        :error-messages="messageFor(field.key)"
        clearable
        @update:model-value="set(field.key, normalize($event))"
      />

      <div v-else-if="field.type === 'boolean' && !field.array" class="attribute__switch">
        <v-switch
          :id="`attr-${field.key}`"
          :model-value="values[field.key] === true"
          :label="values[field.key] === true ? t('common.yes') : t('common.no')"
          :error-messages="messageFor(field.key)"
          @update:model-value="set(field.key, $event === true)"
        />
      </div>

      <v-combobox
        v-else-if="field.array"
        :id="`attr-${field.key}`"
        :model-value="asList(values[field.key])"
        :placeholder="t('common.pressEnter')"
        :error-messages="messageFor(field.key)"
        multiple
        chips
        closable-chips
        @update:model-value="set(field.key, typedList(field, $event))"
      />

      <v-textarea
        v-else-if="field.type === 'multi_field'"
        :id="`attr-${field.key}`"
        :model-value="asText(values[field.key])"
        placeholder="{ }"
        rows="2"
        auto-grow
        dir="ltr"
        class="attribute__code"
        :error-messages="messageFor(field.key)"
        @update:model-value="set(field.key, castInput(field, $event))"
      />

      <v-text-field
        v-else
        :id="`attr-${field.key}`"
        :model-value="asText(values[field.key])"
        :type="inputType(field.type)"
        :min="field.min ?? undefined"
        :max="field.max ?? undefined"
        :step="stepOf(field)"
        :dir="field.type === 'string' ? 'auto' : 'ltr'"
        :error-messages="messageFor(field.key)"
        @update:model-value="set(field.key, castInput(field, $event))"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { JsonValue } from '@/domain/json'
import type { FieldType, SchemeField } from '@/domain/scheme'
import { castInput, fieldLabel, hasOptions, isNumeric } from '@/domain/scheme'
import type { ValueProblem } from '@/domain/validation'
import { describeBounds } from '@/domain/validation'
import { useI18n } from '@/i18n'
import FieldLabel from '@/shared/components/FieldLabel.vue'

const props = defineProps<{
  fields: SchemeField[]
  values: Record<string, JsonValue>
  problems: Record<string, ValueProblem>
}>()

const emit = defineEmits<{ 'update:values': [values: Record<string, JsonValue>] }>()

const { t, language } = useI18n()

const set = (key: string, value: JsonValue) => emit('update:values', { ...props.values, [key]: value })

const messageFor = (key: string): string | undefined => {
  const problem = props.problems[key]

  return problem === undefined ? undefined : t(problem.message, problem.params)
}

const hintFor = (field: SchemeField): string =>
  describeBounds(field)
    .map((part) => t(part.message, part.params))
    .join(' · ')

const inputType = (type: FieldType): string => (isNumeric(type) ? 'number' : type === 'date' ? 'date' : 'text')

const stepOf = (field: SchemeField): string | number | undefined => {
  if (!isNumeric(field.type)) return undefined

  return field.step ?? (field.type === 'confined_number' ? 1 : 'any')
}

const asText = (value: JsonValue | undefined): string => {
  if (value === null || value === undefined) return ''

  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

const asList = (value: JsonValue | undefined): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item))

  return value === null || value === undefined || value === '' ? [] : [String(value)]
}

const asChoice = (value: JsonValue | undefined): string | null =>
  value === null || value === undefined ? null : String(value)

const normalize = (value: unknown): JsonValue => {
  if (Array.isArray(value)) return value.map((item) => String(item))

  return value === null || value === undefined ? null : String(value)
}

/** Items typed into a list field, stored as the field's own type. */
const typedList = (field: SchemeField, typed: unknown): JsonValue => {
  const items = Array.isArray(typed) ? typed.map((item) => String(item)) : []
  if (isNumeric(field.type)) {
    return items.map((item) => {
      const parsed = Number(item)

      return Number.isNaN(parsed) ? item : parsed
    })
  }
  if (field.type === 'boolean') return items.map((item) => item.trim().toLowerCase() === 'true')

  return items
}
</script>

<style scoped>
.attributes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1rem 1.1rem;
}

.attribute {
  min-inline-size: 0;
}

.attribute--wide {
  grid-column: 1 / -1;
}

.attribute__switch {
  display: flex;
  align-items: center;
  min-block-size: 3rem;
}

.attribute__code :deep(textarea) {
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 0.8125rem;
}
</style>
