<script setup lang="ts">
/**
 * The input of one declared field, chosen by its type (enum select, checkbox, map point, date, chips for
 * lists, text area, number or text box). Label: "*" when required, the local name, "(unit)", and an info
 * tooltip with the description. Values are emitted the way the service stores them.
 */
import { Info, Plus, X } from 'lucide-vue-next'
import {
  Button, Checkbox, Combobox, Field, Input, Textarea, Tooltip, formatDate, formatDateTime, localName, translate as t,
  type ComboOption,
} from '@truth-platform/ui'
import { computed, ref } from 'vue'
import type { FieldDefinition, JsonValue } from '@/api/taxonomy'
import ChipsInput from './ChipsInput.vue'
import CoordinateField from './CoordinateField.vue'

const props = defineProps<{ field: FieldDefinition; modelValue: JsonValue | undefined; showErrors?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: JsonValue] }>()

const id = computed(() => `field-${props.field.key}`)
const displayName = computed(() => localName({ name: props.field.name, name_he: props.field.metadata?.name_he }))
const placeholder = computed(() => props.field.metadata?.placeholder ?? t('input.enter', { name: displayName.value }))
const type = computed(() => props.field.type)
const isDate = computed(() => type.value === 'date' || type.value === 'datetime')
const listValue = computed<JsonValue[]>(() => {
  const v = props.modelValue
  if (v === null || v === undefined || v === '') return []
  return Array.isArray(v) ? v : [v]
})
const stringValue = computed(() => (props.modelValue === null || props.modelValue === undefined ? '' : String(props.modelValue)))

const missing = computed(() => {
  if (!props.field.required) return false
  if (props.field.array) return listValue.value.length === 0
  const v = props.modelValue
  return v === null || v === undefined || String(v) === '' || (Array.isArray(v) && v.length === 0)
})
const error = computed(() => (props.showErrors && missing.value ? t('input.required', { name: displayName.value }) : null))

const enumOptions = computed<ComboOption<string>[]>(() =>
  (props.field.metadata?.options ?? []).map((o) => ({ value: o, label: o })),
)
const enumModel = computed({
  get: () => (props.field.array ? listValue.value.map(String) : props.modelValue === null || props.modelValue === undefined ? null : String(props.modelValue)),
  set: (v: string | string[] | null | undefined) => {
    if (Array.isArray(v)) emit('update:modelValue', v.length ? [...v] : null)
    else emit('update:modelValue', v === null || v === undefined || v === '' ? null : String(v))
  },
})

const pendingDate = ref('')
function addDate() {
  if (!pendingDate.value) return
  emit('update:modelValue', [...listValue.value, pendingDate.value])
  pendingDate.value = ''
}
function removeDate(i: number) {
  const left = listValue.value.filter((_, j) => j !== i)
  emit('update:modelValue', left.length ? left : null)
}
const dateLabel = (v: JsonValue) => (type.value === 'datetime' ? formatDateTime(String(v)) : formatDate(String(v)))

const chipsModel = computed({
  get: () => listValue.value.filter((v) => v !== null && typeof v !== 'object') as (string | number)[],
  set: (v: (string | number)[]) => emit('update:modelValue', v.length ? [...v] : null),
})

function onNumber(v: string | number | null | undefined) {
  const s = v === null || v === undefined ? '' : String(v)
  emit('update:modelValue', s.trim() === '' ? null : Number(s))
}
function onText(v: string | number | null | undefined) {
  emit('update:modelValue', v === null || v === undefined ? '' : String(v))
}
</script>

<template>
  <Field :for="id" :error="error" :class="type === 'coordinate' || type === 'text' ? 'col-span-full' : undefined">
    <template #label>
      <span v-if="field.required" class="me-0.5 text-danger">*</span>
      <span dir="auto">{{ displayName }}</span>
      <span v-if="field.metadata?.unit" class="ms-1 text-muted-foreground" dir="auto">({{ field.metadata.unit }})</span>
    </template>
    <template v-if="field.metadata?.description" #aside>
      <Tooltip :content="field.metadata.description">
        <button type="button" class="rounded p-0.5 text-muted-foreground hover:text-foreground" :aria-label="t('input.whatMeans', { name: displayName })">
          <Info class="size-3.5" />
        </button>
      </Tooltip>
    </template>

    <Combobox
      v-if="type === 'enum'"
      :id="id"
      v-model="enumModel"
      :options="enumOptions"
      :multiple="field.array"
      :placeholder="placeholder"
      :invalid="!!error"
    />

    <label v-else-if="type === 'boolean'" class="flex h-9 items-center gap-2 text-sm">
      <Checkbox :id="id" :model-value="modelValue === true" @update:model-value="(v) => emit('update:modelValue', v === true)" />
      <span dir="auto">{{ displayName }}</span>
    </label>

    <CoordinateField v-else-if="type === 'coordinate'" :id="id" :model-value="modelValue" :label="displayName" @update:model-value="(v) => emit('update:modelValue', v)" />

    <div v-else-if="isDate && field.array" class="flex flex-col gap-1.5">
      <div class="flex items-center gap-1.5">
        <Input
          :id="id"
          v-model="pendingDate"
          :type="type === 'datetime' ? 'datetime-local' : 'date'"
          dir="ltr"
          :aria-label="t('input.addDate')"
          :invalid="!!error"
          @keydown.enter.prevent="addDate"
        />
        <Button variant="secondary" size="icon" :disabled="!pendingDate" :aria-label="t('input.addDate')" :title="t('input.addDate')" @click="addDate">
          <Plus />
        </Button>
      </div>
      <div v-if="listValue.length" class="flex flex-wrap gap-1.5">
        <span v-for="(v, i) in listValue" :key="`${i}-${v}`" class="inline-flex items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-xs" dir="ltr">
          {{ dateLabel(v) }}
          <button type="button" class="text-muted-foreground hover:text-foreground" :aria-label="t('common.remove')" @click="removeDate(i)"><X class="size-3" /></button>
        </span>
      </div>
    </div>

    <Input
      v-else-if="isDate"
      :id="id"
      :model-value="stringValue"
      :type="type === 'datetime' ? 'datetime-local' : 'date'"
      dir="ltr"
      :invalid="!!error"
      @update:model-value="onText"
    />

    <ChipsInput
      v-else-if="field.array"
      :id="id"
      v-model="chipsModel"
      :numeric="type === 'number' || type === 'integer' ? type : null"
      :placeholder="placeholder"
      :invalid="!!error"
    />

    <Textarea v-else-if="type === 'text'" :id="id" :model-value="stringValue" rows="3" dir="auto" :placeholder="placeholder" :invalid="!!error" @update:model-value="onText" />

    <Input
      v-else-if="type === 'number' || type === 'integer'"
      :id="id"
      type="number"
      :step="type === 'integer' ? 1 : 'any'"
      :model-value="stringValue"
      dir="ltr"
      :placeholder="placeholder"
      :invalid="!!error"
      @update:model-value="onNumber"
    />

    <Input v-else :id="id" :model-value="stringValue" dir="auto" :placeholder="placeholder" :invalid="!!error" @update:model-value="onText" />
  </Field>
</template>
