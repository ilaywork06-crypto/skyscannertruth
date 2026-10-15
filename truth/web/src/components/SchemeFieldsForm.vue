<script setup lang="ts">
/** One input per declared field, keyed by the field's key, with the problems shown under each. */
import { Checkbox, Combobox, Field, Input, translate as t, type ComboOption } from '@truth-platform/ui'
import type { JsonValue } from '@/models'
import { fieldLabel, hasOptions, isNumeric, type SchemeField } from '@/lib/scheme'
import TagInput from './TagInput.vue'

const props = defineProps<{ fields: SchemeField[]; problems?: Record<string, string> }>()
const values = defineModel<Record<string, JsonValue>>({ default: () => ({}) })

function set(key: string, value: JsonValue) {
  values.value = { ...values.value, [key]: value }
}

function bounds(f: SchemeField): string {
  if (!isNumeric(f.type)) return ''
  let text = ''
  if (f.min !== null && f.max !== null) text = t('bounds.between', { min: f.min, max: f.max })
  else if (f.min !== null) text = t('bounds.atLeast', { min: f.min })
  else if (f.max !== null) text = t('bounds.atMost', { max: f.max })
  if (f.step !== null) text = text ? `${text}, ${t('bounds.step', { step: f.step })}` : t('bounds.step', { step: f.step })
  return text
}

const optionsOf = (f: SchemeField): ComboOption<string>[] => f.options.map((o) => ({ value: o, label: o }))

function choice(f: SchemeField): string | string[] | null {
  const v = values.value[f.key]
  if (f.array) return Array.isArray(v) ? v.map(String) : []
  return v === null || v === undefined ? null : String(v)
}

function items(f: SchemeField): string[] {
  const v = values.value[f.key]
  return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))) : []
}
function setItems(f: SchemeField, list: string[]) {
  if (isNumeric(f.type)) {
    set(f.key, list.map((x) => (x.trim() !== '' && !Number.isNaN(Number(x)) ? Number(x) : x)))
  } else if (f.type === 'boolean') {
    set(f.key, list.map((x) => x.toLowerCase() === 'true'))
  } else set(f.key, list)
}

function textOf(f: SchemeField): string {
  const v = values.value[f.key]
  if (v === null || v === undefined) return ''
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

/** Empty is nothing; a number when it parses (a half-typed "1." is kept as text); a structure when it parses. */
function cast(f: SchemeField, text: string | number | null | undefined): JsonValue {
  const raw = text === null || text === undefined ? '' : String(text)
  if (raw === '') return null
  if (isNumeric(f.type)) {
    const n = Number(raw)
    return Number.isNaN(n) ? raw : n
  }
  if (f.type === 'multi_field') {
    try {
      return JSON.parse(raw) as JsonValue
    } catch {
      return raw
    }
  }
  return raw
}

const inputType = (f: SchemeField) => (isNumeric(f.type) ? 'number' : f.type === 'date' ? 'date' : 'text')
const stepOf = (f: SchemeField) => (f.step !== null ? f.step : f.type === 'confined_number' ? 1 : 'any')
const problem = (f: SchemeField) => props.problems?.[f.key] ?? null
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2">
    <Field v-for="f in fields" :key="f.key" :error="problem(f)" :for="`field-${f.key}`" :class="f.type === 'multi_field' || (f.type === 'string' && !f.array) ? 'sm:col-span-2' : ''">
      <template #label>
        <span v-if="f.required" class="me-0.5 text-danger">*</span>
        <span dir="auto">{{ fieldLabel(f) }}</span>
        <span v-if="bounds(f)" class="ms-1 font-normal text-muted-foreground">({{ bounds(f) }})</span>
      </template>
      <Combobox
        v-if="hasOptions(f.type)"
        :id="`field-${f.key}`"
        :model-value="choice(f)"
        :options="optionsOf(f)"
        :multiple="f.array"
        :placeholder="t('form.select')"
        :invalid="!!problem(f)"
        @update:model-value="(v) => set(f.key, (v ?? (f.array ? [] : null)) as JsonValue)"
      />
      <label v-else-if="f.type === 'boolean' && !f.array" class="flex h-9 items-center gap-2.5">
        <Checkbox :id="`field-${f.key}`" :model-value="values[f.key] === true" @update:model-value="(v) => set(f.key, v === true)" />
      </label>
      <TagInput
        v-else-if="f.array"
        :id="`field-${f.key}`"
        :model-value="items(f)"
        :input-type="isNumeric(f.type) ? 'number' : f.type === 'date' ? 'date' : 'text'"
        :invalid="!!problem(f)"
        @update:model-value="(list) => setItems(f, list)"
      />
      <Input
        v-else
        :id="`field-${f.key}`"
        :model-value="textOf(f)"
        :type="inputType(f)"
        :min="f.min ?? undefined"
        :max="f.max ?? undefined"
        :step="isNumeric(f.type) ? stepOf(f) : undefined"
        :placeholder="f.type === 'multi_field' ? '{ }' : undefined"
        :dir="inputType(f) === 'text' ? 'auto' : 'ltr'"
        :class="f.type === 'multi_field' ? 'mono' : ''"
        :invalid="!!problem(f)"
        @update:model-value="(v) => set(f.key, cast(f, v))"
      />
    </Field>
  </div>
</template>
