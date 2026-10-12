<template>
  <v-dialog
    :model-value="modelValue"
    max-width="66rem"
    scrollable
    @update:model-value="onDialogModel"
  >
    <v-card class="assumption-form">
      <v-card-title class="assumption-form__title">
        {{ t('create.title') }}
      </v-card-title>

      <!--
        One form rather than two steps: what every assumption carries, and straight after it the attributes its
        industries' schemas declare. Which schemas those are follows from the industries picked - nobody has to
        know the schemas by name to file an assumption correctly.
      -->
      <v-card-text class="assumption-form__body">
        <div class="assumption-form__field">
          <label
            class="assumption-form__label"
            for="assumption-text"
          ><span class="assumption-form__required">*</span> {{ t('create.text') }}</label>
          <v-textarea
            id="assumption-text"
            v-model="assumptionText"
            :placeholder="t('create.textPlaceholder')"
            :error-messages="showErrors && assumptionText.trim().length === 0 ? t('create.textRequired') : undefined"
            dir="auto"
            rows="3"
            auto-grow
            autofocus
          />
        </div>

        <div class="assumption-form__grid">
          <div class="assumption-form__field">
            <label
              class="assumption-form__label"
              for="assumption-party"
            ><span class="assumption-form__required">*</span> {{ t('create.proposingParty') }}</label>
            <v-combobox
              id="assumption-party"
              v-model="proposingParty"
              :items="knownParties"
              :placeholder="t('create.partyPlaceholder')"
              :error-messages="showErrors && partyText.length === 0 ? t('create.partyRequired') : undefined"
            />
          </div>

          <div class="assumption-form__field">
            <label
              class="assumption-form__label"
              for="assumption-industries"
            ><span class="assumption-form__required">*</span> {{ t('create.industries') }}</label>
            <v-select
              id="assumption-industries"
              v-model="industryIds"
              :items="industryOptions"
              :placeholder="t('create.industriesPlaceholder')"
              :error-messages="showErrors && industryIds.length === 0 ? t('create.industriesRequired') : undefined"
              multiple
              chips
              closable-chips
            />
          </div>

          <div class="assumption-form__field">
            <label
              class="assumption-form__label"
              for="assumption-validators"
            >{{ t('create.validators') }}</label>
            <v-combobox
              id="assumption-validators"
              v-model="validators"
              :items="knownValidators"
              :placeholder="t('input.pressEnter')"
              multiple
              chips
              closable-chips
            />
          </div>

          <div class="assumption-form__field">
            <label
              class="assumption-form__label"
              for="assumption-tags"
            >{{ t('create.tags') }}</label>
            <v-combobox
              id="assumption-tags"
              v-model="tags"
              :items="knownTags"
              :placeholder="t('input.pressEnter')"
              multiple
              chips
              closable-chips
            />
          </div>
        </div>

        <v-divider />

        <section class="assumption-form__section">
          <SectionHeader
            icon="mdi-table-cog"
            :title="t('create.fields')"
            :count="fields.length"
          >
            <UiChip
              v-for="schema in pickedSchemas"
              :key="schema.id"
              :label="schema.name"
              :token="hashedToken(schema.name)"
            />
          </SectionHeader>

          <p
            v-if="industryIds.length === 0"
            class="assumption-form__muted"
          >
            {{ t('create.pickIndustry') }}
          </p>
          <p
            v-else-if="fields.length === 0"
            class="assumption-form__muted"
          >
            {{ t('create.noFields') }}
          </p>
          <SchemeFieldsForm
            v-else
            :fields="fields"
            :values="values"
            :problems="problems"
            @update:values="values = $event"
          />
        </section>
      </v-card-text>

      <v-divider />

      <v-card-actions class="assumption-form__actions">
        <v-spacer />
        <v-btn
          variant="text"
          @click="attemptClose"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :loading="saving"
          :disabled="saving"
          @click="create"
        >
          {{ t('create.create') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <UnsavedChangesDialog
    v-model="confirmOpen"
    @discard="discard"
  />
</template>

<script lang="ts">
import type { JsonValue } from '@truth-platform/core-ui'


interface Props {
  modelValue: boolean
  /** The industry the dialog was opened from, which a new assumption is filed under to begin with. */
  industry?: string | null
}

interface Emits {
  (event: 'update:modelValue', open: boolean): void
  (event: 'created', assumptionId: string): void
}

/**
 * How long the name an assumption is stored under may be.
 *
 * The API still asks every assumption for a name, and nothing on screen shows one any more, so it is taken
 * from the assumption itself: its first line, cut short where a title would be.
 */
const NAME_LENGTH = 80

/**
 * Work out the name an assumption is stored under from what it says.
 */
const deriveName = (text: string): string => {
  const firstLine = text.trim().split(/\r?\n/)[0]?.trim() ?? ''

  return firstLine.length <= NAME_LENGTH ? firstLine : `${firstLine.slice(0, NAME_LENGTH - 1).trimEnd()}…`
}

/**
 * Keep only the values of the attributes still being asked for.
 *
 * Industries can be picked and unpicked while the form is open, and a value typed under a schema that no
 * longer applies is not one the assumption is declared with.
 */
const pickValues = (values: Record<string, JsonValue>, keys: string[]): Record<string, JsonValue> =>
  Object.fromEntries(Object.entries(values).filter(([key, value]) => keys.includes(key) && value !== null))
</script>

<script setup lang="ts">
import {
  SectionHeader,
  UiChip,
  UnsavedChangesDialog,
  hashedToken,
  useDirtyGuard,
  useLanguage,
  useSnackbar,
} from '@truth-platform/core-ui'
import { computed, ref, shallowRef, watch } from 'vue'

import SchemeFieldsForm from '@/components/SchemeFieldsForm.vue'
import { useRegister } from '@/composables/useRegister'
import type { SchemaDetail } from '@/models/schema'
import type { SchemeField } from '@/models/scheme'
import { createAssumption } from '@/requests/assumptions'
import { validateValues } from '@/utils/constraints'
import { readCreator } from '@/utils/identity'

const props = withDefaults(defineProps<Props>(), { industry: null })
const emit = defineEmits<Emits>()

const { industries, assumptions, findIndustry, schemasForIndustries, fieldsForIndustries } = useRegister()
const { notify, reportError } = useSnackbar()
const { t } = useLanguage()

const saving = ref<boolean>(false)
const showErrors = ref<boolean>(false)

const assumptionText = ref<string>('')
/* A combobox hands back whatever was typed or picked, which is a string here but is not typed as one. */
const proposingParty = ref<string | null>('')
const industryIds = ref<string[]>([])
const tags = ref<string[]>([])
const validators = ref<string[]>([])
const values = shallowRef<Record<string, JsonValue>>({})
const problems = ref<Record<string, string>>({})

/* What the form held when it was opened, which is what "nothing changed" is measured against. */
const openedWith = ref<string>('')

const partyText = computed<string>(() => String(proposingParty.value ?? '').trim())

const industryOptions = computed<{ title: string; value: string }[]>(() =>
  industries.value.map((industry) => ({ title: industry.name, value: industry.id })),
)

/* The schemas the picked industries are declared by, and the attributes those ask for. */
const pickedSchemas = computed<SchemaDetail[]>(() =>
  industryIds.value.length === 0 ? [] : schemasForIndustries(industryIds.value),
)
const fields = computed<SchemeField[]>(() =>
  industryIds.value.length === 0 ? [] : fieldsForIndustries(industryIds.value),
)

/**
 * Read one column of the register as the vocabulary a free text field offers to pick from.
 *
 * Nothing in this API declares who may propose an assumption or what it may be tagged with, so the register
 * itself is what the suggestions come from - which keeps a second spelling of the same party from creeping in.
 */
const knownValues = (read: (row: (typeof assumptions.value)[number]) => string[]): string[] => {
  const seen = new Set<string>()
  assumptions.value.forEach((row) => read(row).forEach((value) => value.length > 0 && seen.add(value)))

  return [...seen].sort((left, right) => left.localeCompare(right))
}

const knownParties = computed<string[]>(() => knownValues((row) => [row.proposing_party]))
const knownTags = computed<string[]>(() => knownValues((row) => row.tags))
const knownValidators = computed<string[]>(() => knownValues((row) => row.validation_responsible_parties))

const snapshot = (): string =>
  JSON.stringify([assumptionText.value, partyText.value, industryIds.value, tags.value, validators.value, values.value])

const close = () => {
  emit('update:modelValue', false)
}

const { confirmOpen, attemptClose, discard } = useDirtyGuard({
  isDirty: () => !saving.value && snapshot() !== openedWith.value,
  close,
})

/* A click outside the dialog or Escape asks to close it, which the guard answers. */
const onDialogModel = (open: boolean) => {
  if (!open) {
    attemptClose()
  }
}

/**
 * Empty the form, filed under the industry it was opened from.
 */
const reset = () => {
  problems.value = {}
  saving.value = false
  showErrors.value = false

  const home = props.industry === null ? undefined : findIndustry(props.industry)
  assumptionText.value = ''
  proposingParty.value = ''
  industryIds.value = home === undefined ? [] : [home.id]
  tags.value = []
  validators.value = []
  values.value = {}

  openedWith.value = snapshot()
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      reset()
    }
  },
)

/* Once somebody has tried to create, the complaints follow what they change rather than waiting for the next try. */
watch([fields, values], () => {
  if (showErrors.value) {
    problems.value = validateValues(fields.value, values.value)
  }
})

/**
 * Store the assumption, once what was filled in satisfies the restrictions its schemas declare.
 */
const create = async () => {
  showErrors.value = true
  problems.value = validateValues(fields.value, values.value)

  const complete =
    assumptionText.value.trim().length > 0 && partyText.value.length > 0 && industryIds.value.length > 0
  if (!complete || Object.keys(problems.value).length > 0) {
    notify(t('form.fixProblems'), 'warning')

    return
  }

  saving.value = true
  try {
    const assumptionId = await createAssumption({
      name: deriveName(assumptionText.value),
      assumption_text: assumptionText.value.trim(),
      proposing_party: partyText.value,
      schemas: pickedSchemas.value.map((schema) => schema.id),
      values: pickValues(
        values.value,
        fields.value.map((field) => field.key),
      ),
      tags: tags.value,
      validation_responsible_parties: validators.value,
      creator: readCreator(),
      /* The service takes an industry by its uuid or by its name; the name is what it has always been sent. */
      industries: industryIds.value.map((id) => findIndustry(id)?.name ?? id),
      /* Nothing in the API says what may go in here, so it is sent as the empty object it is documented as. */
      special_fields: {},
    })

    notify(t('create.created'), 'success')
    emit('created', assumptionId)
    close()
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.assumption-form {
  background-color: rgb(var(--v-theme-surface));
}

.assumption-form__title {
  padding-inline: 1.5rem;
  padding-block: 1.25rem 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
}

.assumption-form__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-inline: 1.5rem;
}

/*
 * The fields flow into as many columns as the dialog has room for, so the form is one column in a narrow
 * window and several across on a wide screen without either being written down as a breakpoint.
 */
.assumption-form__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  align-items: start;
  gap: 0.875rem 1rem;
}

.assumption-form__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-inline-size: 0;
}

.assumption-form__label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8125rem;
  font-weight: 500;
}

.assumption-form__required {
  color: rgb(var(--v-theme-error));
}

.assumption-form__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.assumption-form__muted {
  color: rgb(var(--v-theme-app-muted));
  font-size: 0.875rem;
}

.assumption-form__actions {
  padding-inline: 1.5rem;
  padding-block: 0.75rem;
}
</style>
