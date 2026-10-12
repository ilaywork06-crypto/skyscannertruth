<template>
  <div
    class="dynamic-field"
    :class="{ 'dynamic-field--wide': isWide }"
  >
    <label
      class="dynamic-field__label"
      :for="inputId"
    >
      <span
        v-if="field.required"
        class="dynamic-field__required"
      >*</span>
      {{ displayName }}
      <span
        v-if="field.metadata.unit !== null"
        class="dynamic-field__unit"
      >({{ field.metadata.unit }})</span>
      <!--
        The explanation a field was declared with belongs next to the field, not in a manual. It rides on
        the information icon so it costs no room until somebody wants it.
      -->
      <UiInfoIcon
        v-if="helpText.length > 0"
        :label="t('input.whatMeans', { name: displayName })"
      >
        {{ helpText }}
      </UiInfoIcon>
    </label>

    <v-select
      v-if="field.type === 'enum'"
      :id="inputId"
      :model-value="selectValue"
      :items="field.metadata.options"
      :multiple="field.array"
      :chips="field.array"
      :closable-chips="field.array"
      :placeholder="placeholder"
      :rules="rules"
      @update:model-value="onSelect"
    />

    <v-checkbox
      v-else-if="field.type === 'boolean'"
      :id="inputId"
      :model-value="modelValue === true"
      hide-details
      @update:model-value="emit('update:modelValue', $event ?? false)"
    />

    <CoordinateField
      v-else-if="field.type === 'coordinate'"
      :model-value="modelValue"
      :label="displayName"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <!--
      A field declared as a list of dates is filled one day at a time: a day is picked, added to the chips under
      the box with the button beside it, and the box empties for the next one. Adding on the pick itself would
      add a day for every digit typed into the year.
    -->
    <div
      v-else-if="isDate && field.array"
      class="dynamic-field__list"
    >
      <div class="dynamic-field__adder">
        <DateField
          v-model="pendingDate"
          :with-time="field.type === 'datetime'"
          :placeholder="t('input.addDate')"
          :rules="rules"
        />
        <v-btn
          icon="mdi-plus"
          variant="text"
          :disabled="pendingDate.length === 0"
          :aria-label="t('input.addDate')"
          :title="t('input.addDate')"
          @click="addDate"
        />
      </div>
      <div
        v-if="listValue.length > 0"
        class="dynamic-field__chips"
      >
        <v-chip
          v-for="(item, index) in listValue"
          :key="`${item}-${index}`"
          closable
          dir="ltr"
          @click:close="removeItem(index)"
        >
          {{ dateLabel(item) }}
        </v-chip>
      </div>
    </div>

    <DateField
      v-else-if="isDate"
      :model-value="stringValue"
      :with-time="field.type === 'datetime'"
      :placeholder="field.metadata.placeholder ?? ''"
      :rules="rules"
      @update:model-value="onText"
    />

    <!--
      Any other list is typed value by value: each Enter turns what was typed into a chip of its own, and a
      number field only takes what reads as a number.
    -->
    <v-combobox
      v-else-if="field.array"
      :id="inputId"
      :model-value="comboValue"
      :placeholder="placeholder"
      :rules="rules"
      :hint="t('input.pressEnter')"
      :error-messages="rejectedItem ? t('input.numbersOnly') : undefined"
      persistent-hint
      multiple
      chips
      closable-chips
      @update:model-value="onCombo"
    />

    <v-textarea
      v-else-if="field.type === 'text'"
      :id="inputId"
      :model-value="stringValue"
      :placeholder="placeholder"
      rows="3"
      :rules="rules"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <v-text-field
      v-else
      :id="inputId"
      :model-value="stringValue"
      :type="isNumeric ? 'number' : 'text'"
      :placeholder="placeholder"
      :rules="rules"
      @update:model-value="onText"
    />
  </div>
</template>

<script lang="ts">
import type { JsonValue } from '../models/common'
import { UiInfoIcon } from '../index'
import type { FieldDefinition } from '../models/field'

interface Props {
  field: FieldDefinition
  modelValue: JsonValue
}

interface Emits {
  (event: 'update:modelValue', value: JsonValue): void
}

type ValidationRule = (value: unknown) => true | string
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'

import CoordinateField from './CoordinateField.vue'
import DateField from './DateField.vue'
import { useLanguage } from '../composables/useLanguage'
import { formatDate, formatDateTime } from '../utils/format'
import { localName } from '../utils/names'

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t, language } = useLanguage()

const inputId = computed<string>(() => `field-${props.field.key}`)

/* A map is unreadable squeezed into one column of the grid, so a point takes the whole row it sits on. */
const isWide = computed<boolean>(() => props.field.type === 'coordinate')

const isDate = computed<boolean>(() => props.field.type === 'date' || props.field.type === 'datetime')

const isNumeric = computed<boolean>(() => props.field.type === 'number' || props.field.type === 'integer')

/* The field under the name the page is read in, which is its Hebrew one on a Hebrew page when it has one. */
const displayName = computed<string>(() => {
  void language.value

  return localName({ name: props.field.name, name_he: props.field.metadata.name_he })
})

const helpText = computed<string>(() => props.field.metadata.description ?? '')

/*
 * A placeholder is read inside the box it sits in and is clipped the moment it grows past it, so it stays a
 * short instruction. What the field means is explained on the information icon of the label instead, where
 * there is room for a whole sentence.
 */
const placeholder = computed<string>(
  () => props.field.metadata.placeholder ?? t('input.enter', { name: displayName.value }),
)

const selectValue = computed<string | string[] | null>(() => {
  const value = props.modelValue
  if (value === null || value === undefined) {
    return props.field.array ? [] : null
  }

  return Array.isArray(value) ? value.map((item) => String(item)) : String(value)
})

const onSelect = (value: string | readonly string[] | null) => {
  if (value === null) {
    emit('update:modelValue', null)
    return
  }

  emit('update:modelValue', Array.isArray(value) ? [...value] : String(value))
}

const stringValue = computed<string>(() => {
  const value = props.modelValue

  return value === null || value === undefined ? '' : String(value)
})

/* The values of a list, read tolerantly: a single stored value is a list of one. */
const listValue = computed<JsonValue[]>(() => {
  const value = props.modelValue
  if (value === null || value === undefined || value === '') {
    return []
  }

  return Array.isArray(value) ? value : [value]
})

const comboValue = computed<string[]>(() => listValue.value.map((item) => String(item)))

const isEmpty = (value: unknown): boolean =>
  value === null || value === undefined || String(value).length === 0 || (Array.isArray(value) && value.length === 0)

const rules = computed<ValidationRule[]>(() => {
  if (!props.field.required) {
    return []
  }

  /* A list is judged by what it holds, not by the box the next value is typed into. */
  return [
    (value) =>
      !(props.field.array ? listValue.value.length === 0 : isEmpty(value))
      || t('input.required', { name: displayName.value }),
  ]
})

const onText = (value: string) => {
  if (isNumeric.value) {
    emit('update:modelValue', value.length === 0 ? null : Number(value))
    return
  }

  emit('update:modelValue', value)
}

/** Whether the last value typed into a list of numbers was turned away for not being one. */
const rejectedItem = ref<boolean>(false)

/**
 * Read one typed item of a list as the type the field holds, or nothing when it does not read as one.
 */
const readItem = (item: string): JsonValue | undefined => {
  const trimmed = item.trim()
  if (trimmed.length === 0) {
    return undefined
  }

  if (!isNumeric.value) {
    return trimmed
  }

  const number = Number(trimmed)
  if (!Number.isFinite(number) || (props.field.type === 'integer' && !Number.isInteger(number))) {
    return undefined
  }

  return number
}

const onCombo = (items: readonly unknown[] | null) => {
  const typed = (items ?? []).map((item) => String(item))
  const read = typed.map(readItem)
  rejectedItem.value = read.some((item) => item === undefined)
  const kept = read.filter((item): item is JsonValue => item !== undefined)
  emit('update:modelValue', kept.length === 0 ? null : kept)
}

/* The box a list of dates is filled through, which empties again as soon as its pick joins the list. */
const pendingDate = ref<string>('')

const addDate = () => {
  const picked = pendingDate.value
  if (picked.length === 0) {
    return
  }

  emit('update:modelValue', [...listValue.value, picked])
  pendingDate.value = ''
}

const removeItem = (index: number) => {
  const kept = listValue.value.filter((_, candidate) => candidate !== index)
  emit('update:modelValue', kept.length === 0 ? null : kept)
}

const dateLabel = (item: JsonValue): string =>
  props.field.type === 'datetime' ? formatDateTime(String(item)) : formatDate(String(item))
</script>

<style scoped>
.dynamic-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-inline-size: 0;
}

.dynamic-field--wide {
  grid-column: 1 / -1;
}

.dynamic-field__label {
  font-size: 0.875rem;
}

.dynamic-field__required {
  color: rgb(var(--v-theme-error));
  margin-inline-end: 0.125rem;
}

.dynamic-field__unit {
  opacity: 0.65;
  font-size: 0.75rem;
}

.dynamic-field__list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.dynamic-field__adder {
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
}

.dynamic-field__adder > :first-child {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.dynamic-field__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
</style>
