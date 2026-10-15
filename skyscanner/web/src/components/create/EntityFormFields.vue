<script setup lang="ts">
/**
 * The entity sub-form: type, name, module (a select when the industry declares modules, else free text),
 * status (parsed / partially parsed only with parsed files, switched automatically as files come and go),
 * code version, notes, the declared data fields and the three file picks.
 */
import { Combobox, Field, Input, Select, localName, translate as t, valueLabel, type ComboOption, type SelectOption } from '@truth-platform/ui'
import { computed, watch } from 'vue'
import type { EntityStatus } from '@/api/create'
import type { EntityType, FieldDefinition, FieldType, JsonValue } from '@/api/taxonomy'
import Dropzone from './Dropzone.vue'
import MetadataFieldsPanel from './MetadataFieldsPanel.vue'
import NotesInput from './NotesInput.vue'
import { ENTITY_STATUS_OPTIONS, PARSED_STATUSES, type EntityFormValue } from './entityForm'

const props = withDefaults(
  defineProps<{
    modelValue: EntityFormValue
    entityTypes: EntityType[]
    fields: FieldDefinition[]
    modules?: string[]
    lockType?: boolean
    idPrefix?: string
    /** Parsed files the entity already stores (edit), counted for the status rule. */
    storedParsedCount?: number
    context?: Record<string, JsonValue>
    showErrors?: boolean
  }>(),
  { modules: () => [], lockType: false, idPrefix: 'entity', storedParsedCount: 0, context: () => ({}) },
)
const emit = defineEmits<{ 'update:modelValue': [value: EntityFormValue] }>()

let pending: EntityFormValue = props.modelValue
watch(
  () => props.modelValue,
  (v) => (pending = v),
)
function patch(changes: Partial<EntityFormValue>) {
  pending = { ...pending, ...changes }
  emit('update:modelValue', pending)
}

const isParsed = computed(() => props.storedParsedCount + props.modelValue.parsedFiles.length > 0)
const statusOptions = computed<SelectOption<EntityStatus>[]>(() =>
  ENTITY_STATUS_OPTIONS.map((s) => ({ value: s, label: valueLabel(s), disabled: PARSED_STATUSES.includes(s) && !isParsed.value })),
)
const typeOptions = computed<ComboOption<string>[]>(() => props.entityTypes.map((type) => ({ value: type.key, label: localName(type) })))
const moduleOptions = computed<ComboOption<string>[]>(() => props.modules.map((m) => ({ value: m, label: m })))

watch(
  () => [isParsed.value, props.modelValue.status] as const,
  ([parsed, status]) => {
    if (parsed && !PARSED_STATUSES.includes(status)) patch({ status: 'parsed' })
    else if (!parsed && PARSED_STATUSES.includes(status)) patch({ status: 'raw' })
  },
)

const nameMissing = computed(() => props.showErrors && !props.modelValue.name.trim())
const typeMissing = computed(() => props.showErrors && !props.modelValue.typeKey)
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field :label="t('entityForm.type')" required :for="`${idPrefix}-type`" :error="typeMissing ? t('entities.nameMissing') : null">
        <Combobox
          :id="`${idPrefix}-type`"
          :model-value="modelValue.typeKey"
          :options="typeOptions"
          :disabled="lockType"
          :clearable="false"
          :placeholder="t('entityForm.type')"
          :invalid="typeMissing"
          @update:model-value="(v) => patch({ typeKey: (v as string | null) ?? null })"
        />
      </Field>
      <Field :label="t('entityForm.name')" required :for="`${idPrefix}-name`" :error="nameMissing ? t('entities.nameMissing') : null">
        <Input
          :id="`${idPrefix}-name`"
          :model-value="modelValue.name"
          dir="auto"
          :invalid="nameMissing"
          @update:model-value="(v) => patch({ name: String(v ?? '') })"
        />
      </Field>
      <Field :label="t('entityForm.module')" :for="`${idPrefix}-module`">
        <Combobox
          v-if="modules.length"
          :id="`${idPrefix}-module`"
          :model-value="modelValue.module"
          :options="moduleOptions"
          :placeholder="t('entityForm.module')"
          @update:model-value="(v) => patch({ module: (v as string | null) ?? null })"
        />
        <Input
          v-else
          :id="`${idPrefix}-module`"
          :model-value="modelValue.module ?? ''"
          dir="auto"
          @update:model-value="(v) => patch({ module: String(v ?? '').length ? String(v) : null })"
        />
      </Field>
      <Field :label="t('entityForm.status')" :for="`${idPrefix}-status`" :hint="isParsed ? undefined : t('entityForm.parsedNeedsFiles')">
        <Select
          :id="`${idPrefix}-status`"
          :model-value="modelValue.status"
          :options="statusOptions"
          @update:model-value="(v) => v && patch({ status: v })"
        />
      </Field>
      <Field :label="t('entityForm.codeVersion')" :for="`${idPrefix}-code`">
        <Input :id="`${idPrefix}-code`" :model-value="modelValue.codeVersion" dir="ltr" class="mono" @update:model-value="(v) => patch({ codeVersion: String(v ?? '') })" />
      </Field>
      <Field :label="t('entityForm.notes')" :for="`${idPrefix}-notes`" class="sm:row-span-2">
        <NotesInput :id="`${idPrefix}-notes`" :model-value="modelValue.notes" @update:model-value="(v) => patch({ notes: v })" />
      </Field>
    </div>

    <MetadataFieldsPanel
      :model-value="modelValue.values"
      :types="modelValue.valueTypes"
      :fields="fields"
      :context="context"
      :title="t('entityForm.data')"
      :show-errors="showErrors"
      @update:model-value="(v: Record<string, JsonValue>) => patch({ values: v })"
      @update:types="(v: Record<string, FieldType>) => patch({ valueTypes: v })"
    />

    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Dropzone compact :label="t('entityForm.rawFiles')" :files="modelValue.rawFiles" @update:files="(f) => patch({ rawFiles: f })" />
      <Dropzone compact :label="t('entityForm.parsedFiles')" :files="modelValue.parsedFiles" @update:files="(f) => patch({ parsedFiles: f })" />
      <Dropzone
        compact
        :label="t('entityForm.parsedAdditionalFiles')"
        :files="modelValue.parsedAdditionalFiles"
        @update:files="(f) => patch({ parsedAdditionalFiles: f })"
      />
    </div>
  </div>
</template>
