<template>
  <div class="builder">
    <SectionHeader
      :title="t('schemas.attributes')"
      :count="scheme.fields.length"
    >
      <v-btn
        variant="tonal"
        color="primary"
        size="small"
        prepend-icon="mdi-plus"
        @click="addField"
      >
        {{ t('schemas.addAttribute') }}
      </v-btn>
    </SectionHeader>

    <p
      v-if="scheme.fields.length === 0"
      class="builder__empty"
    >
      {{ t('schemas.firstAttribute') }}
    </p>

    <!--
      One card per attribute: what it is stored under and what kind of value it holds on the first line, what
      it is called on the second, and whatever its kind asks for beyond that on the third.
    -->
    <div
      v-for="(field, index) in scheme.fields"
      :key="index"
      class="builder__field"
    >
      <div class="builder__row builder__row--head">
        <span class="builder__index">{{ index + 1 }}</span>
        <KeyField
          class="builder__key"
          :model-value="field.key"
          :taken="otherKeys(index)"
          :hint="field.key.length === 0 ? t('names.keyEnglish') : undefined"
          density="compact"
          @update:model-value="updateField(index, { key: $event })"
        />
        <v-select
          class="builder__type"
          :model-value="field.type"
          :items="typeOptions(field.type)"
          :label="t('schemas.type')"
          density="compact"
          @update:model-value="changeType(index, $event)"
        />
        <v-switch
          class="builder__flag"
          :model-value="field.required"
          :label="t('schemas.required')"
          color="primary"
          density="compact"
          hide-details
          inset
          @update:model-value="updateField(index, { required: $event === true })"
        />
        <v-switch
          class="builder__flag"
          :model-value="field.array"
          :label="t('schemas.many')"
          color="primary"
          density="compact"
          hide-details
          inset
          @update:model-value="updateField(index, { array: $event === true })"
        />
        <v-btn
          class="builder__remove"
          icon="mdi-delete-outline"
          variant="text"
          size="small"
          :aria-label="t('schemas.removeAttribute', { name: labelOf(field) })"
          :title="t('schemas.removeAttribute', { name: labelOf(field) })"
          @click="removeField(index)"
        />
      </div>

      <!--
        The display name is written in English, in Hebrew, or in both, and at least one of the two is needed.
        The key follows the English name until somebody writes a key of their own.
      -->
      <NameFields
        :english="fieldNames(field).english"
        :hebrew="fieldNames(field).hebrew"
        :show-errors="field.key.trim().length > 0 || touched.has(index)"
        @update:english="renameField(index, { english: $event, hebrew: fieldNames(field).hebrew })"
        @update:hebrew="renameField(index, { english: fieldNames(field).english, hebrew: $event })"
      />

      <v-combobox
        v-if="hasOptions(field.type)"
        :model-value="field.options"
        :label="t('schemas.options')"
        :placeholder="t('input.pressEnter')"
        :error-messages="field.options.length === 0 ? t('schemas.optionsRequired') : undefined"
        density="compact"
        multiple
        chips
        closable-chips
        @update:model-value="updateField(index, { options: $event.map((option) => String(option)) })"
      />

      <div
        v-else-if="isNumeric(field.type)"
        class="builder__row"
      >
        <v-text-field
          :model-value="asText(field.min)"
          :label="t('schemas.min')"
          :placeholder="t('schemas.optional')"
          type="number"
          density="compact"
          dir="ltr"
          @update:model-value="updateField(index, { min: asNumber(field.type, $event) })"
        />
        <v-text-field
          :model-value="asText(field.max)"
          :label="t('schemas.max')"
          :placeholder="t('schemas.optional')"
          type="number"
          density="compact"
          dir="ltr"
          @update:model-value="updateField(index, { max: asNumber(field.type, $event) })"
        />
        <v-text-field
          :model-value="asText(field.step)"
          :label="t('schemas.step')"
          :placeholder="t('schemas.optional')"
          type="number"
          density="compact"
          dir="ltr"
          @update:model-value="updateField(index, { step: asNumber(field.type, $event) })"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { NamePair } from '@truth-platform/core-ui'

import type { Scheme, SchemeField, SchemeFieldType } from '@/models/scheme'

interface Props {
  scheme: Scheme
}

interface Emits {
  (event: 'update:scheme', scheme: Scheme): void
}

/**
 * The kinds of attribute this builder offers when a new one is declared.
 *
 * The service accepts two kinds that are deliberately not here - an ultra enum and a multi field - because
 * what they carry beyond the keys every field has is not written down yet, and a picker that offered them
 * would let somebody declare one that is missing whatever those are. They are still read, still shown, and
 * still written back exactly as they were found; they simply cannot be invented here yet.
 */
const OFFERED_TYPES: SchemeFieldType[] = ['string', 'boolean', 'confined_number', 'confined_float', 'enum', 'date']

/**
 * The kinds one field may be set to: the ones this builder offers, and the one the field already is.
 *
 * A field declared elsewhere as a kind this builder does not offer would otherwise open with an empty
 * picker - one keystroke away from writing that nothing back. Its own kind is therefore always among the
 * choices, so it displays as what it is and stays that unless somebody deliberately changes it.
 */
const typeOptions = (current: SchemeFieldType): { title: string; value: SchemeFieldType }[] => {
  const offered = OFFERED_TYPES.includes(current) ? OFFERED_TYPES : [...OFFERED_TYPES, current]

  return offered.map((type) => ({ title: typeLabel(type), value: type }))
}
</script>

<script setup lang="ts">
import { KeyField, NameFields, SectionHeader, toKey, useLanguage } from '@truth-platform/core-ui'
import { ref } from 'vue'

import { fieldNames, hasOptions, isNumeric, typeLabel, withNames } from '@/utils/scheme'

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useLanguage()

/* The attributes somebody has started naming, which are the ones worth telling that a name is missing. */
const touched = ref<Set<number>>(new Set())

const otherKeys = (index: number): string[] =>
  props.scheme.fields.filter((_, at) => at !== index).map((field) => field.key.trim())

const labelOf = (field: SchemeField): string => {
  const names = fieldNames(field)

  return names.english || names.hebrew || field.key || t('schemas.thisAttribute')
}

/**
 * Render a bound as the text its input shows, leaving one that was never set empty.
 */
const asText = (value: number | null): string => (value === null ? '' : String(value))

/**
 * Read a typed bound, keeping a whole number whole and refusing anything that is not a number at all.
 */
const asNumber = (type: SchemeFieldType, typed: string): number | null => {
  if (typed.trim().length === 0) {
    return null
  }

  const parsed = Number(typed)
  if (Number.isNaN(parsed)) {
    return null
  }

  return type === 'confined_number' ? Math.round(parsed) : parsed
}

const emitFields = (fields: SchemeField[]) => {
  emit('update:scheme', { fields })
}

const addField = () => {
  emitFields([
    ...props.scheme.fields,
    {
      key: '',
      displayName: '',
      displayNameHebrew: '',
      /* A field declared here is this client's own, so it carries nothing it does not know about. */
      extras: {},
      type: 'string',
      required: false,
      array: false,
      options: [],
      min: null,
      max: null,
      step: null,
      order: props.scheme.fields.length,
    },
  ])
}

const updateField = (index: number, change: Partial<SchemeField>) => {
  emitFields(props.scheme.fields.map((field, at) => (at === index ? { ...field, ...change } : field)))
}

/**
 * Rename one attribute, and carry the key along while it still follows the English name.
 */
const renameField = (index: number, pair: NamePair) => {
  touched.value = new Set(touched.value).add(index)
  emitFields(
    props.scheme.fields.map((field, at) => {
      if (at !== index) {
        return field
      }

      const following = field.key.length === 0 || field.key === toKey(fieldNames(field).english)
      const renamed = withNames(field, pair)

      return following ? { ...renamed, key: toKey(pair.english) } : renamed
    }),
  )
}

/**
 * Change what kind of attribute one field is, dropping whatever the previous kind carried.
 *
 * The bounds of a number mean nothing to an enumeration and its options mean nothing to a number, so they
 * are cleared rather than kept and written out alongside a type that never asked for them.
 */
const changeType = (index: number, type: SchemeFieldType) => {
  updateField(index, { type, options: [], min: null, max: null, step: null })
}

const removeField = (index: number) => {
  touched.value = new Set(
    [...touched.value].filter((at) => at !== index).map((at) => (at > index ? at - 1 : at)),
  )
  emitFields(props.scheme.fields.filter((_, at) => at !== index))
}
</script>

<style scoped>
.builder {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.builder__empty {
  padding-block: 1rem;
  text-align: center;
  color: rgb(var(--v-theme-app-muted));
  font-size: 0.875rem;
}

.builder__field {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.875rem;
  border: 0.0625rem solid rgb(var(--v-theme-app-border));
  border-radius: 0.75rem;
  background-color: rgb(var(--v-theme-surface-bright));
}

/*
 * One attribute is a row of inputs that wraps rather than a fixed grid, so a narrow window stacks it into a
 * legible column instead of squeezing every input into the width of one.
 */
.builder__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem 0.75rem;
}

.builder__row > * {
  flex: 1 1 9rem;
  min-inline-size: 0;
}

.builder__row--head {
  align-items: center;
}

.builder__index {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  inline-size: 1.75rem;
  block-size: 1.75rem;
  border-radius: 50%;
  background-color: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
  font-size: 0.8125rem;
  font-weight: 700;
}

.builder__key {
  flex: 2 1 12rem;
}

.builder__type {
  flex: 1 1 9rem;
}

.builder .builder__flag {
  flex: 0 0 auto;
}

.builder .builder__remove {
  flex: 0 0 auto;
}
</style>
