<script setup lang="ts">
/**
 * The declared fields of a form: own fields, then the "Additional data" block, each shown only while its
 * dependencies hold (hidden values are kept and still submitted). Keys stored under no declaration are listed
 * with their value and can be removed.
 */
import { AlertTriangle, Tag } from 'lucide-vue-next'
import { Badge, Button, EMPTY_PLACEHOLDER, applicableFields, translate as t } from '@truth-platform/ui'
import { computed } from 'vue'
import type { FieldDefinition, FieldType, JsonValue } from '@/api/taxonomy'
import DynamicFieldInput from './DynamicFieldInput.vue'

const props = withDefaults(
  defineProps<{
    modelValue: Record<string, JsonValue>
    types?: Record<string, FieldType>
    fields: FieldDefinition[]
    title?: string
    /** The event's values, read by entity dependencies on event fields. */
    context?: Record<string, JsonValue>
    showErrors?: boolean
  }>(),
  { title: '', types: () => ({}), context: () => ({}) },
)
const emit = defineEmits<{
  'update:modelValue': [value: Record<string, JsonValue>]
  'update:types': [value: Record<string, FieldType>]
}>()

const own = computed(() => applicableFields(props.fields.filter((f) => !f.additional), props.modelValue, props.context))
const additional = computed(() => applicableFields(props.fields.filter((f) => f.additional), props.modelValue, props.context))
const declared = computed(() => new Set(props.fields.map((f) => f.key)))
const filled = computed(() => Object.values(props.modelValue).filter((v) => v !== null && v !== undefined && v !== '').length)
const undeclared = computed(() =>
  Object.entries(props.modelValue)
    .filter(([key]) => !declared.value.has(key))
    .map(([key, value]) => ({
      key,
      display: value === null || value === undefined || value === '' ? EMPTY_PLACEHOLDER : typeof value === 'object' ? JSON.stringify(value) : String(value),
    })),
)

function patch(field: FieldDefinition, value: JsonValue) {
  emit('update:modelValue', { ...props.modelValue, [field.key]: value })
  emit('update:types', { ...props.types, [field.key]: field.type })
}
function removeKey(key: string) {
  const values = { ...props.modelValue }
  const types = { ...props.types }
  delete values[key]
  delete types[key]
  emit('update:modelValue', values)
  emit('update:types', types)
}
</script>

<template>
  <section class="rounded-xl border border-border bg-muted/20 p-4">
    <header class="mb-3 flex items-center gap-2">
      <Tag class="size-4 text-muted-foreground" />
      <h4 class="text-sm font-semibold" dir="auto">{{ title || t('entityForm.data') }}</h4>
      <Badge tone="neutral" class="tabular-nums">{{ filled }}</Badge>
    </header>
    <div v-if="own.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <DynamicFieldInput
        v-for="field in own"
        :key="field.id"
        :field="field"
        :model-value="modelValue[field.key]"
        :show-errors="showErrors"
        @update:model-value="(v) => patch(field, v)"
      />
    </div>
    <p v-else class="text-sm text-muted-foreground">{{ EMPTY_PLACEHOLDER }}</p>

    <div class="mt-4 border-t border-border pt-3">
      <h5 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{{ t('entityForm.additionalData') }}</h5>
      <div v-if="additional.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DynamicFieldInput
          v-for="field in additional"
          :key="field.id"
          :field="field"
          :model-value="modelValue[field.key]"
          :show-errors="showErrors"
          @update:model-value="(v) => patch(field, v)"
        />
      </div>
      <p v-else class="text-sm text-muted-foreground">{{ EMPTY_PLACEHOLDER }}</p>
    </div>

    <div v-if="undeclared.length" class="mt-4 rounded-lg border border-warning/40 bg-warning-soft/50 p-3">
      <div class="mb-2 flex items-center gap-2 text-[13px] font-medium text-warning-foreground">
        <AlertTriangle class="size-4" /> {{ t('metadata.undeclared') }}
      </div>
      <ul class="flex flex-col gap-1.5">
        <li v-for="entry in undeclared" :key="entry.key" class="flex items-center gap-3 text-sm">
          <code class="mono rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">{{ entry.key }}</code>
          <span class="min-w-0 flex-1 truncate" dir="auto" :title="entry.display">{{ entry.display }}</span>
          <Button variant="ghost" size="xs" @click="removeKey(entry.key)">{{ t('common.remove') }}</Button>
        </li>
      </ul>
    </div>
  </section>
</template>
