<template>
  <div class="builder">
    <header class="builder__head">
      <h3 class="builder__title">
        {{ t('builder.attributes') }}
        <span class="builder__count">{{ rows.length }}</span>
      </h3>
      <v-btn variant="tonal" color="primary" size="small" prepend-icon="mdi-plus" @click="add">{{ t('builder.add') }}</v-btn>
    </header>

    <EmptyState v-if="rows.length === 0" compact icon="mdi-shape-plus-outline" :title="t('builder.empty')" />

    <transition-group name="list" tag="div" class="builder__list">
      <article
        v-for="(row, index) in rows"
        :key="row.uid"
        class="attr"
        :class="{ 'attr--invalid': showErrors && problems[index] }"
      >
        <header class="attr__head">
          <span class="attr__index tabular">{{ index + 1 }}</span>
          <span class="attr__name bidi">{{ fieldLabel(row.field, language) || t('builder.untitled') }}</span>
          <ValueChip :label="typeLabel(row.field.type)" neutral variant="dot" />
          <v-spacer />
          <v-btn icon="mdi-arrow-up" variant="text" size="x-small" :disabled="index === 0" :aria-label="t('builder.moveUp')" @click="move(index, -1)" />
          <v-btn icon="mdi-arrow-down" variant="text" size="x-small" :disabled="index === rows.length - 1" :aria-label="t('builder.moveDown')" @click="move(index, 1)" />
          <v-btn icon="mdi-trash-can-outline" variant="text" size="x-small" color="error" :aria-label="t('builder.remove')" @click="remove(index)" />
        </header>

        <div class="attr__grid">
          <v-text-field
            :model-value="fieldNames(row.field).en"
            :label="t('builder.nameEn')"
            dir="ltr"
            density="compact"
            @update:model-value="setNames(index, { ...fieldNames(row.field), en: $event })"
          />
          <v-text-field
            :model-value="fieldNames(row.field).he"
            :label="t('builder.nameHe')"
            dir="rtl"
            density="compact"
            @update:model-value="setNames(index, { ...fieldNames(row.field), he: $event })"
          />
          <v-text-field
            :model-value="row.field.key"
            :label="t('builder.key')"
            :hint="t('builder.keyHint')"
            dir="ltr"
            density="compact"
            class="attr__key"
            @update:model-value="setKey(index, $event)"
          />
          <v-select
            :model-value="row.field.type"
            :items="typeItems(row.field.type)"
            :label="t('builder.type')"
            density="compact"
            @update:model-value="patch(index, { type: $event })"
          />
        </div>

        <div class="attr__extras">
          <v-switch :model-value="row.field.required" :label="t('builder.required')" @update:model-value="patch(index, { required: $event === true })" />
          <v-switch :model-value="row.field.array" :label="t('builder.many')" @update:model-value="patch(index, { array: $event === true })" />

          <v-combobox
            v-if="hasOptions(row.field.type)"
            :model-value="row.field.options"
            :label="t('builder.options')"
            :placeholder="t('common.pressEnter')"
            multiple
            chips
            closable-chips
            density="compact"
            class="attr__options"
            @update:model-value="patch(index, { options: ($event as string[]).map(String) })"
          />

          <div v-if="isNumeric(row.field.type)" class="attr__bounds">
            <v-text-field
              v-for="bound in BOUNDS"
              :key="bound"
              :model-value="row.field[bound] ?? ''"
              :label="t(`builder.${bound}`)"
              type="number"
              dir="ltr"
              density="compact"
              @update:model-value="patch(index, { [bound]: toNumber($event) })"
            />
          </div>
        </div>

        <p v-if="showErrors && problems[index]" class="attr__problem">
          <v-icon icon="mdi-alert-circle-outline" size="15" />{{ t(problems[index] ?? '') }}
        </p>
      </article>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { toKey } from '@/domain/names'
import type { FieldType, SchemeField } from '@/domain/scheme'
import {
  DECLARABLE_TYPES,
  emptyField,
  fieldLabel,
  fieldNames,
  hasOptions,
  isNumeric,
  schemeProblems,
  typeLabel,
  withNames,
} from '@/domain/scheme'
import { useI18n } from '@/i18n'
import EmptyState from '@/shared/components/EmptyState.vue'
import ValueChip from '@/shared/components/ValueChip.vue'

interface BuilderRow {
  uid: number
  field: SchemeField
  /** Once a key is typed by hand (or the field already existed) it no longer follows the English name. */
  keyTouched: boolean
}

const BOUNDS = ['min', 'max', 'step'] as const

const props = defineProps<{ modelValue: SchemeField[]; showErrors: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [fields: SchemeField[]] }>()

const { t, language } = useI18n()

let nextUid = 1
const rows = ref<BuilderRow[]>([])
let lastEmitted: SchemeField[] | null = null

/* Adopt fields handed in from outside (opening the dialog), but not our own echo. */
watch(
  () => props.modelValue,
  (fields) => {
    if (fields === lastEmitted) return
    rows.value = fields.map((field) => ({ uid: nextUid++, field, keyTouched: field.key.length > 0 }))
  },
  { immediate: true },
)

const commit = () => {
  lastEmitted = rows.value.map((row) => row.field)
  emit('update:modelValue', lastEmitted)
}

const problems = computed(() => schemeProblems(rows.value.map((row) => row.field)))

/** The types offered: the declarable ones, plus a field's own type when it is a legacy one. */
const typeItems = (current: FieldType) =>
  [...new Set([...DECLARABLE_TYPES, current])].map((type) => ({ value: type, title: typeLabel(type) }))

const update = (index: number, change: (row: BuilderRow) => BuilderRow) => {
  rows.value = rows.value.map((row, at) => (at === index ? change(row) : row))
  commit()
}

const patch = (index: number, partial: Partial<SchemeField>) =>
  update(index, (row) => ({ ...row, field: { ...row.field, ...partial } }))

const setNames = (index: number, names: { en: string; he: string }) =>
  update(index, (row) => ({
    ...row,
    field: { ...withNames(row.field, names), key: row.keyTouched ? row.field.key : toKey(names.en) },
  }))

const setKey = (index: number, key: string) =>
  update(index, (row) => ({ ...row, keyTouched: key.length > 0, field: { ...row.field, key } }))

const toNumber = (text: string): number | null => {
  if (String(text).trim() === '') return null
  const parsed = Number(text)

  return Number.isNaN(parsed) ? null : parsed
}

const add = () => {
  rows.value = [...rows.value, { uid: nextUid++, field: emptyField(), keyTouched: false }]
  commit()
}

const remove = (index: number) => {
  rows.value = rows.value.filter((_, at) => at !== index)
  commit()
}

const move = (index: number, by: number) => {
  const next = [...rows.value]
  const [row] = next.splice(index, 1)
  if (row === undefined) return
  next.splice(index + by, 0, row)
  rows.value = next
  commit()
}
</script>

<style scoped>
.builder {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.builder__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.builder__title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.95rem;
  font-weight: 700;
}

.builder__count {
  padding: 0 0.45rem;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
  font-size: 0.72rem;
}

.builder__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.attr {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 0.9rem 1rem 1rem;
  border-radius: 14px;
  background: rgb(var(--v-theme-surface-light));
  border: 1px solid rgb(var(--v-theme-border));
  transition: border-color 0.15s;
}

.attr--invalid {
  border-color: rgba(var(--v-theme-error), 0.6);
}

.attr__head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.attr__index {
  display: grid;
  place-items: center;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  border-radius: 7px;
  background: rgb(var(--v-theme-surface-variant));
  font-size: 0.72rem;
  font-weight: 700;
}

.attr__name {
  font-weight: 600;
  font-size: 0.9rem;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attr__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.75rem;
}

.attr__extras {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.25rem;
}

.attr__options {
  flex: 1 1 18rem;
}

.attr__bounds {
  display: flex;
  gap: 0.5rem;
  flex: 1 1 18rem;
}

.attr__problem {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-error));
}

.list-enter-active,
.list-leave-active,
.list-move {
  transition: all 0.2s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
