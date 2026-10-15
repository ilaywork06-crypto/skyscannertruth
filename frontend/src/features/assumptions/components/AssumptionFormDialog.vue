<template>
  <FormDialog
    :model-value="modelValue"
    :title="initial ? t('create.duplicateTitle') : t('create.title')"
    :subtitle="t('create.subtitle')"
    icon="mdi-lightbulb-on-outline"
    max-width="64rem"
    :submit-label="t('common.create')"
    :saving="saving"
    :dirty="dirty"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="submit"
  >
    <div class="form">
      <section class="form__section">
        <div class="form__field">
          <FieldLabel :text="t('create.text')" html-for="assumption-text" required />
          <v-textarea
            id="assumption-text"
            v-model="draft.text"
            :placeholder="t('create.textPlaceholder')"
            :error-messages="showErrors && !draft.text.trim() ? t('create.textRequired') : undefined"
            rows="3"
            auto-grow
            dir="auto"
            autofocus
          />
        </div>

        <div class="form__grid">
          <div class="form__field">
            <FieldLabel :text="t('create.proposingParty')" html-for="assumption-party" required />
            <v-combobox
              id="assumption-party"
              v-model="draft.party"
              :items="known.parties"
              :placeholder="t('create.partyPlaceholder')"
              :error-messages="showErrors && !partyText ? t('create.partyRequired') : undefined"
            />
          </div>

          <div class="form__field">
            <FieldLabel :text="t('create.industries')" html-for="assumption-industries" required />
            <v-autocomplete
              id="assumption-industries"
              v-model="draft.industryIds"
              :items="industryItems"
              :placeholder="t('create.industriesPlaceholder')"
              :error-messages="showErrors && draft.industryIds.length === 0 ? t('create.industriesRequired') : undefined"
              multiple
              chips
              closable-chips
            />
          </div>

          <div class="form__field">
            <FieldLabel :text="t('create.validators')" html-for="assumption-validators" />
            <v-combobox
              id="assumption-validators"
              v-model="draft.validators"
              :items="known.validators"
              :placeholder="t('common.pressEnter')"
              multiple
              chips
              closable-chips
            />
          </div>

          <div class="form__field">
            <FieldLabel :text="t('create.tags')" html-for="assumption-tags" />
            <v-combobox
              id="assumption-tags"
              v-model="draft.tags"
              :items="known.tags"
              :placeholder="t('common.pressEnter')"
              multiple
              chips
              closable-chips
            />
          </div>
        </div>
      </section>

      <section class="form__section form__section--attributes">
        <header class="form__section-head">
          <div>
            <h3 class="form__section-title">
              {{ t('create.fields') }}
              <span v-if="fields.length > 0" class="form__count">{{ fields.length }}</span>
            </h3>
            <p class="form__section-hint">{{ t('create.fieldsHint') }}</p>
          </div>
          <div class="form__schemas">
            <ValueChip v-for="schema in schemas" :key="schema.id" :label="schema.name" />
          </div>
        </header>

        <EmptyState
          v-if="draft.industryIds.length === 0"
          compact
          icon="mdi-domain"
          :title="t('create.pickIndustry')"
        />
        <EmptyState v-else-if="fields.length === 0" compact icon="mdi-shape-outline" :title="t('create.noFields')" />
        <AttributeFields v-else v-model:values="draft.values" :fields="fields" :problems="problems" />
      </section>
    </div>
  </FormDialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue'

import { assumptionsApi } from '@/api'
import { deriveName } from '@/domain/assumption'
import type { JsonValue } from '@/domain/json'
import type { AssumptionDetail } from '@/domain/models'
import type { ValueProblem } from '@/domain/validation'
import { validateValues } from '@/domain/validation'
import { useI18n } from '@/i18n'
import EmptyState from '@/shared/components/EmptyState.vue'
import FieldLabel from '@/shared/components/FieldLabel.vue'
import FormDialog from '@/shared/components/FormDialog.vue'
import ValueChip from '@/shared/components/ValueChip.vue'
import { currentCreator } from '@/shared/utils/identity'
import { useNotifications } from '@/stores/notifications'
import { useRegisterStore } from '@/stores/register'

import AttributeFields from './AttributeFields.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** The industry the form opens under. */
    industryId?: string | null
    /** An assumption to prefill the form with (duplicating). */
    initial?: AssumptionDetail | null
  }>(),
  { industryId: null, initial: null },
)

const emit = defineEmits<{ 'update:modelValue': [open: boolean]; created: [assumptionId: string] }>()

const { t } = useI18n()
const register = useRegisterStore()
const { notify, reportError } = useNotifications()

interface Draft {
  text: string
  party: string | null
  industryIds: string[]
  validators: string[]
  tags: string[]
  values: Record<string, JsonValue>
}

const draft = reactive<Draft>({ text: '', party: null, industryIds: [], validators: [], tags: [], values: {} })
const problems = shallowRef<Record<string, ValueProblem>>({})
const showErrors = ref(false)
const saving = ref(false)
const openedWith = ref('')

const partyText = computed(() => String(draft.party ?? '').trim())
const industryItems = computed(() => register.industries.map((industry) => ({ title: industry.name, value: industry.id })))
const schemas = computed(() => register.schemasFor(draft.industryIds))
const fields = computed(() => register.fieldsFor(draft.industryIds))

/** Values already used across the register, offered as suggestions. */
const known = computed(() => {
  const collect = (read: (row: (typeof register.assumptions)[number]) => string[]) =>
    [...new Set(register.assumptions.flatMap(read).filter(Boolean))].sort((a, b) => a.localeCompare(b))

  return {
    parties: collect((row) => [row.proposing_party]),
    validators: collect((row) => row.validation_responsible_parties),
    tags: collect((row) => row.tags),
  }
})

const snapshot = () => JSON.stringify(draft)
const dirty = computed(() => !saving.value && snapshot() !== openedWith.value)

const reset = () => {
  const source = props.initial
  const home = props.industryId === null ? undefined : register.findIndustry(props.industryId)
  draft.text = source?.assumption_text ?? ''
  draft.party = source?.proposing_party ?? null
  draft.industryIds = source ? source.industries.map((industry) => industry.id) : home ? [home.id] : []
  draft.validators = [...(source?.validation_responsible_parties ?? [])]
  draft.tags = [...(source?.tags ?? [])]
  draft.values = { ...(source?.values ?? {}) }
  problems.value = {}
  showErrors.value = false
  saving.value = false
  openedWith.value = snapshot()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) reset()
  },
)

/* Re-check live once the reader has tried to submit. */
watch(
  () => [draft.values, fields.value],
  () => {
    if (showErrors.value) problems.value = validateValues(fields.value, draft.values)
  },
  { deep: true },
)

/** Only values of attributes the chosen schemas declare are sent. */
const declaredValues = (): Record<string, JsonValue> => {
  const keys = new Set(fields.value.map((field) => field.key))

  return Object.fromEntries(Object.entries(draft.values).filter(([key, value]) => keys.has(key) && value !== null))
}

const submit = async () => {
  showErrors.value = true
  problems.value = validateValues(fields.value, draft.values)
  const complete = draft.text.trim() && partyText.value && draft.industryIds.length > 0
  if (!complete || Object.keys(problems.value).length > 0) {
    notify(t('create.fixProblems'), 'warning')

    return
  }

  saving.value = true
  try {
    const id = await assumptionsApi.create({
      name: deriveName(draft.text),
      assumption_text: draft.text.trim(),
      proposing_party: partyText.value,
      schemas: schemas.value.map((schema) => schema.id),
      values: declaredValues(),
      tags: draft.tags,
      validation_responsible_parties: draft.validators,
      creator: currentCreator(),
      industries: draft.industryIds,
      special_fields: {},
    })
    await register.refreshAssumption(id)
    notify(t('create.created'), 'success')
    emit('created', id)
    emit('update:modelValue', false)
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form__section {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form__section--attributes {
  padding: 1.25rem;
  border-radius: 16px;
  background: rgb(var(--v-theme-surface-light));
  border: 1px solid rgb(var(--v-theme-border));
}

.form__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  gap: 1rem 1.1rem;
}

.form__section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.form__section-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.95rem;
  font-weight: 700;
}

.form__count {
  padding: 0 0.45rem;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.15);
  color: rgb(var(--v-theme-primary));
  font-size: 0.72rem;
}

.form__section-hint {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}

.form__schemas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
</style>
