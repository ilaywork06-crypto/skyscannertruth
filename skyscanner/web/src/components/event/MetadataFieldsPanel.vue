<script setup lang="ts">
/**
 * The declared fields of a record (spec §7.5): its own fields, then the "Additional data" block, each shown only
 * while its dependencies hold (a hidden field keeps its value), and the values stored under keys nothing
 * declares - which can be removed.
 */
import { AlertTriangle, Tag, Trash2 } from 'lucide-vue-next'
import { Button, EMPTY_PLACEHOLDER, applicableFields, isFilled, translate as t } from '@truth-platform/ui'
import { computed } from 'vue'
import type { FieldDefinition, FieldType, JsonValue } from '@/api/taxonomy'
import DynamicFieldInput from './DynamicFieldInput.vue'

const props = withDefaults(
  defineProps<{
    fields: FieldDefinition[]
    values: Record<string, JsonValue>
    types: Record<string, FieldType>
    title: string
    /** The event's values, which an entity field's dependencies may read. */
    context?: Record<string, JsonValue>
    showErrors?: boolean
  }>(),
  { context: () => ({}), showErrors: false },
)
const emit = defineEmits<{ 'update:values': [values: Record<string, JsonValue>]; 'update:types': [types: Record<string, FieldType>] }>()

const applicable = computed(() => applicableFields(props.fields, props.values as Record<string, unknown>, props.context as Record<string, unknown>))
const own = computed(() => applicable.value.filter((f) => !f.additional))
const additional = computed(() => applicable.value.filter((f) => f.additional))
const declared = computed(() => new Set(props.fields.map((f) => f.key)))
const undeclared = computed(() => Object.keys(props.values).filter((k) => !declared.value.has(k) && isFilled(props.values[k])))
const filled = computed(() => Object.values(props.values).filter((v) => v !== null && v !== undefined && v !== '').length)

function set(field: FieldDefinition, value: JsonValue) {
  emit('update:values', { ...props.values, [field.key]: value })
  emit('update:types', { ...props.types, [field.key]: field.type })
}
function drop(key: string) {
  const values = { ...props.values }
  const types = { ...props.types }
  delete values[key]
  delete types[key]
  emit('update:values', values)
  emit('update:types', types)
}
const show = (v: JsonValue) => (v === null || v === undefined || v === '' ? EMPTY_PLACEHOLDER : typeof v === 'object' ? JSON.stringify(v) : String(v))
</script>

<template>
  <section class="rounded-xl border border-border bg-muted/30 p-4">
    <header class="mb-3 flex items-center gap-2">
      <Tag class="size-4 text-muted-foreground" />
      <h4 class="text-[13px] font-semibold">{{ title }}</h4>
      <span class="rounded-full bg-subtle px-1.5 text-[11px] leading-5 text-muted-foreground tabular-nums">{{ filled }}</span>
    </header>
    <div v-if="own.length" class="grid gap-4 sm:grid-cols-2">
      <DynamicFieldInput v-for="f in own" :key="f.id" :field="f" :model-value="values[f.key]" :show-errors="showErrors" @update:model-value="(v) => set(f, v)" />
    </div>
    <p v-else class="text-[13px] text-muted-foreground">{{ EMPTY_PLACEHOLDER }}</p>

    <div class="mt-4 border-t border-border pt-3">
      <h5 class="mb-2 text-xs font-medium text-muted-foreground">{{ t('entityForm.additionalData') }}</h5>
      <div v-if="additional.length" class="grid gap-4 sm:grid-cols-2">
        <DynamicFieldInput v-for="f in additional" :key="f.id" :field="f" :model-value="values[f.key]" :show-errors="showErrors" @update:model-value="(v) => set(f, v)" />
      </div>
      <p v-else class="text-[13px] text-muted-foreground">{{ EMPTY_PLACEHOLDER }}</p>
    </div>

    <div v-if="undeclared.length" class="mt-4 rounded-lg border border-warning/40 bg-warning-soft/50 p-3">
      <h5 class="mb-2 flex items-center gap-1.5 text-xs font-medium text-warning-foreground"><AlertTriangle class="size-3.5" />{{ t('metadata.undeclared') }}</h5>
      <div v-for="k in undeclared" :key="k" class="flex items-center gap-3 py-1 text-[13px]">
        <code class="mono rounded bg-subtle px-1.5 py-0.5 text-xs" dir="ltr">{{ k }}</code>
        <span class="min-w-0 flex-1 truncate" dir="auto" :title="show(values[k])">{{ show(values[k]) }}</span>
        <Button size="xs" variant="ghost" @click="drop(k)"><Trash2 /> {{ t('common.remove') }}</Button>
      </div>
    </div>
  </section>
</template>
