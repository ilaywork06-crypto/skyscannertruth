<script setup lang="ts">
/** The input for one declared field, by its type (spec core-ui §5.16). */
import { Info, Plus, X } from 'lucide-vue-next'
import {
  Button, Checkbox, Combobox, Input, Textarea, Tooltip, cn, fieldClass, formatDate, formatDateTime, localName, translate as t, usePreferences,
} from '@truth-platform/ui'
import { computed, ref } from 'vue'
import type { FieldDefinition, JsonValue } from '@/api/taxonomy'
import CoordinateField from './CoordinateField.vue'
import TagInput from './TagInput.vue'

const props = defineProps<{ field: FieldDefinition; modelValue: JsonValue | undefined; showErrors?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: JsonValue] }>()
const { language } = usePreferences()

const id = computed(() => `field-${props.field.key}`)
const name = computed(() => {
  void language.value
  return localName({ name: props.field.name, name_he: props.field.metadata?.name_he })
})
const placeholder = computed(() => props.field.metadata?.placeholder ?? t('input.enter', { name: name.value }))
const listValue = computed<JsonValue[]>(() => {
  const v = props.modelValue
  if (v === null || v === undefined || v === '') return []
  return Array.isArray(v) ? v : [v]
})
const stringValue = computed(() => (props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue)))
const isDate = computed(() => props.field.type === 'date' || props.field.type === 'datetime')
const numeric = computed(() => props.field.type === 'number' || props.field.type === 'integer')

const missing = computed(() => {
  if (!props.field.required) return false
  const v = props.modelValue
  if (props.field.array) return !listValue.value.length
  return v === null || v === undefined || String(v) === '' || (Array.isArray(v) && !v.length)
})
const error = computed(() => (props.showErrors && missing.value ? t('input.required', { name: name.value }) : ''))

const options = computed(() => (props.field.metadata?.options ?? []).map((o) => ({ value: o, label: o })))
function onEnum(v: string | string[] | null | undefined) {
  if (props.field.array) emit('update:modelValue', Array.isArray(v) ? [...v] : [])
  else emit('update:modelValue', v === null || v === undefined ? null : String(v))
}

const rejected = ref(false)
function acceptItem(v: string): boolean {
  if (!numeric.value) return true
  const n = Number(v)
  return Number.isFinite(n) && (props.field.type !== 'integer' || Number.isInteger(n))
}
function onList(items: string[]) {
  rejected.value = false
  const out = items.map((s) => (numeric.value ? Number(s) : s))
  emit('update:modelValue', out.length ? out : null)
}

const pendingDate = ref('')
function addDate() {
  if (!pendingDate.value) return
  emit('update:modelValue', [...listValue.value, pendingDate.value])
  pendingDate.value = ''
}
function removeDate(i: number) {
  const rest = listValue.value.filter((_, k) => k !== i)
  emit('update:modelValue', rest.length ? rest : null)
}

function onText(v: string | number | null | undefined) {
  const s = v === null || v === undefined ? '' : String(v)
  if (numeric.value) emit('update:modelValue', s === '' ? null : Number(s))
  else emit('update:modelValue', s)
}
</script>

<template>
  <div :class="cn('flex min-w-0 flex-col gap-1.5', field.type === 'coordinate' && 'col-span-full')">
    <div class="flex items-center gap-1.5">
      <label :for="id" class="text-[13px] font-medium" dir="auto">
        <span v-if="field.required" class="me-0.5 text-danger">*</span>{{ name }}<span v-if="field.metadata?.unit" class="text-muted-foreground"> ({{ field.metadata.unit }})</span>
      </label>
      <Tooltip v-if="field.metadata?.description" :content="field.metadata.description">
        <button type="button" class="text-muted-foreground/70 hover:text-foreground" :aria-label="t('input.whatMeans', { name })"><Info class="size-3.5" /></button>
      </Tooltip>
    </div>

    <template v-if="field.type === 'enum'">
      <Combobox
        :id="id"
        :model-value="field.array ? (listValue.map(String) as string[]) : (modelValue === null || modelValue === undefined ? null : String(modelValue))"
        :options="options"
        :multiple="field.array"
        :placeholder="placeholder"
        :invalid="!!error"
        @update:model-value="(v) => onEnum(v as string | string[] | null)"
      />
    </template>
    <label v-else-if="field.type === 'boolean'" class="flex h-9 items-center gap-2 text-sm">
      <Checkbox :id="id" :model-value="modelValue === true" @update:model-value="(v) => emit('update:modelValue', v === true)" />
      <span class="text-muted-foreground">{{ modelValue === true ? t('common.yes') : t('common.no') }}</span>
    </label>
    <CoordinateField v-else-if="field.type === 'coordinate'" :model-value="modelValue" :label="name" @update:model-value="(v) => emit('update:modelValue', v as JsonValue)" />
    <template v-else-if="isDate && field.array">
      <div class="flex gap-2">
        <input :id="id" v-model="pendingDate" :type="field.type === 'datetime' ? 'datetime-local' : 'date'" :class="cn(fieldClass, 'h-9')" dir="ltr" :aria-label="t('input.addDate')" />
        <Button size="icon" variant="secondary" :disabled="!pendingDate" :aria-label="t('input.addDate')" :title="t('input.addDate')" @click="addDate"><Plus /></Button>
      </div>
      <div v-if="listValue.length" class="flex flex-wrap gap-1">
        <span v-for="(d, i) in listValue" :key="i" class="inline-flex items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-xs tabular-nums" dir="ltr">
          {{ field.type === 'datetime' ? formatDateTime(String(d)) : formatDate(String(d)) }}
          <button type="button" class="text-muted-foreground hover:text-foreground" :aria-label="t('files.remove', { name: String(d) })" @click="removeDate(i)"><X class="size-3" /></button>
        </span>
      </div>
    </template>
    <input
      v-else-if="isDate"
      :id="id"
      :value="stringValue"
      :type="field.type === 'datetime' ? 'datetime-local' : 'date'"
      :class="cn(fieldClass, 'h-9')"
      :aria-invalid="!!error || undefined"
      dir="ltr"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <template v-else-if="field.array">
      <TagInput
        :id="id"
        :model-value="listValue.map(String)"
        :placeholder="placeholder"
        :invalid="!!error || rejected"
        :accept="acceptItem"
        @rejected="rejected = true"
        @update:model-value="onList"
      />
      <p v-if="rejected" class="text-xs text-danger">{{ t('input.numbersOnly') }}</p>
      <p v-else class="text-xs text-muted-foreground">{{ t('input.pressEnter') }}</p>
    </template>
    <Textarea v-else-if="field.type === 'text'" :id="id" :model-value="stringValue" rows="3" dir="auto" :placeholder="placeholder" :invalid="!!error" @update:model-value="onText" />
    <Input
      v-else
      :id="id"
      :model-value="stringValue"
      :type="numeric ? 'number' : 'text'"
      :dir="numeric ? 'ltr' : 'auto'"
      :placeholder="placeholder"
      :invalid="!!error"
      @update:model-value="onText"
    />
    <p v-if="error" class="text-xs text-danger">{{ error }}</p>
  </div>
</template>
