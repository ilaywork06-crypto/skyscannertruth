<template>
  <v-dialog
    :model-value="modelValue"
    max-width="62rem"
    scrollable
    @update:model-value="onDialogModel"
  >
    <v-card class="schema-form">
      <v-card-title class="schema-form__title">
        {{ revisedSchema === null ? t('schemas.declare') : t('schemas.reviseNamed', { name: revisedSchema.name }) }}
      </v-card-title>

      <v-card-text class="schema-form__body">
        <template v-if="revisedSchema === null">
          <v-text-field
            v-model="name"
            :label="t('schemas.name')"
            :placeholder="t('schemas.namePlaceholder')"
            :error-messages="showErrors && name.trim().length === 0 ? t('schemas.nameRequired') : undefined"
            dir="auto"
            autofocus
          />
          <v-textarea
            v-model="description"
            :label="t('common.description')"
            :placeholder="t('schemas.descriptionPlaceholder')"
            dir="auto"
            rows="2"
            auto-grow
          />
        </template>

        <v-text-field
          v-else
          v-model="revisionReason"
          :label="t('schemas.revisionReason')"
          :placeholder="t('schemas.reasonPlaceholder')"
          :error-messages="showErrors && revisionReason.trim().length === 0 ? t('schemas.reasonRequired') : undefined"
          dir="auto"
          autofocus
        />

        <!--
          A schema is either shared by every industry and every table, or declared for the industries picked
          for it. The two are one choice, so the industries are only asked for once the schema is not global.
        -->
        <template v-if="revisedSchema === null">
          <v-switch
            v-model="isGlobal"
            :label="t('schemas.global')"
            color="primary"
            density="compact"
            hide-details
            inset
          />
          <v-select
            v-if="!isGlobal"
            v-model="industryIds"
            :items="industryOptions"
            :label="t('create.industries')"
            :placeholder="t('create.industriesPlaceholder')"
            :error-messages="showErrors && industryIds.length === 0 ? t('create.industriesRequired') : undefined"
            persistent-placeholder
            multiple
            chips
            closable-chips
          />
        </template>

        <SchemeBuilder
          :scheme="scheme"
          @update:scheme="scheme = $event"
        />
      </v-card-text>

      <v-divider />

      <v-card-actions class="schema-form__actions">
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
          @click="save"
        >
          {{ revisedSchema === null ? t('create.create') : t('schemas.revise') }}
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
import type { SchemaDetail } from '@/models/schema'

interface Props {
  modelValue: boolean
  /** The schema being revised, or nothing when a new one is being declared. */
  revisedSchema?: SchemaDetail | null
}

interface Emits {
  (event: 'update:modelValue', open: boolean): void
  (event: 'created', schemaId: string): void
}

/** The kind of schema, which the service holds as a number and offers no vocabulary for. */
const DEFAULT_SCHEMA_TYPE = 0
</script>

<script setup lang="ts">
import { UnsavedChangesDialog, useDirtyGuard, useLanguage, useSnackbar } from '@truth-platform/core-ui'
import { computed, ref, watch } from 'vue'

import SchemeBuilder from '@/components/SchemeBuilder.vue'
import { useRegister } from '@/composables/useRegister'
import type { Scheme } from '@/models/scheme'
import { createSchema, createSchemaRevision } from '@/requests/schemas'
import { readCreator } from '@/utils/identity'
import { isSchemeValid, readScheme, writeScheme } from '@/utils/scheme'

const props = withDefaults(defineProps<Props>(), { revisedSchema: null })
const emit = defineEmits<Emits>()

const { t } = useLanguage()
const { notify, reportError } = useSnackbar()
const { industries } = useRegister()

const name = ref<string>('')
const description = ref<string>('')
const revisionReason = ref<string>('')
/* The industries the schema is being declared for, held as the identifiers the picker offers. */
const industryIds = ref<string[]>([])
/* Whether the schema is shared by every industry and every table, which makes the industries moot. */
const isGlobal = ref<boolean>(false)
const scheme = ref<Scheme>({ fields: [] })
const saving = ref<boolean>(false)
const showErrors = ref<boolean>(false)

/* What the form held when it was opened, which is what "nothing changed" is measured against. */
const openedWith = ref<string>('')

const snapshot = (): string =>
  JSON.stringify([
    name.value,
    description.value,
    revisionReason.value,
    isGlobal.value,
    industryIds.value,
    scheme.value,
  ])

const industryOptions = computed<{ title: string; value: string }[]>(() =>
  industries.value.map((industry) => ({ title: industry.name, value: industry.id })),
)

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

/* Reopening starts from the schema being revised, or from an empty declaration for a new one. */
watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      return
    }

    const revised = props.revisedSchema
    name.value = ''
    description.value = ''
    revisionReason.value = ''
    industryIds.value = []
    isGlobal.value = false
    showErrors.value = false
    scheme.value = revised === null ? { fields: [] } : readScheme(revised.scheme)
    openedWith.value = snapshot()
  },
)

const isComplete = (): boolean => {
  if (!isSchemeValid(scheme.value)) {
    return false
  }

  if (props.revisedSchema !== null) {
    return revisionReason.value.trim().length > 0
  }

  /* A schema that is not shared by everybody has to say whom it belongs to. */
  return name.value.trim().length > 0 && (isGlobal.value || industryIds.value.length > 0)
}

const save = async () => {
  showErrors.value = true
  if (!isComplete()) {
    notify(t('form.fixProblems'), 'warning')

    return
  }

  saving.value = true
  try {
    const revised = props.revisedSchema
    const schemaId =
      revised === null
        ? await createSchema({
            name: name.value.trim(),
            description: description.value.trim(),
            type: DEFAULT_SCHEMA_TYPE,
            scheme: writeScheme(scheme.value),
            creator: readCreator(),
            /*
             * The service resolves an industry by its identifier or by its name, and an identifier is the
             * road more likely to be paved, so the picker's own identifiers are what go out. A global schema
             * belongs to every industry, so it names none - including any picked before it was made global.
             */
            industries: isGlobal.value ? [] : [...industryIds.value],
            global: isGlobal.value,
          })
        : await createSchemaRevision(revised.id, {
            creator: readCreator(),
            revision_reason: revisionReason.value.trim(),
            scheme: writeScheme(scheme.value),
          })

    notify(
      revised === null
        ? t('schemas.declared', { name: name.value.trim() })
        : t('schemas.revised', { name: revised.name }),
      'success',
    )
    emit('created', schemaId)
    close()
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.schema-form {
  background-color: rgb(var(--v-theme-surface));
}

.schema-form__title {
  padding-inline: 1.5rem;
  padding-block: 1.25rem 0.5rem;
  font-size: 1.375rem;
  font-weight: 700;
}

.schema-form__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-inline: 1.5rem;
}

.schema-form__actions {
  padding-inline: 1.5rem;
  padding-block: 0.75rem;
}
</style>
