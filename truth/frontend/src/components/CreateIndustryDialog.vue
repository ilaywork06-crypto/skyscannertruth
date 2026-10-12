<template>
  <v-dialog
    :model-value="modelValue"
    max-width="32rem"
    @update:model-value="onDialogModel"
  >
    <v-card class="industry-form">
      <v-card-title class="industry-form__title">
        {{ t('industry.create') }}
      </v-card-title>

      <v-card-text class="industry-form__body">
        <v-text-field
          v-model="name"
          :label="t('industry.name')"
          :placeholder="t('industry.namePlaceholder')"
          :error-messages="showErrors && name.trim().length === 0 ? t('industry.nameRequired') : undefined"
          dir="auto"
          autofocus
        />
        <v-textarea
          v-model="description"
          :label="t('common.description')"
          :placeholder="t('industry.descriptionPlaceholder')"
          dir="auto"
          rows="3"
          auto-grow
        />
      </v-card-text>

      <v-card-actions class="industry-form__actions">
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
interface Props {
  modelValue: boolean
}

interface Emits {
  (event: 'update:modelValue', open: boolean): void
  (event: 'created', industryId: string): void
}
</script>

<script setup lang="ts">
import { UnsavedChangesDialog, useDirtyGuard, useLanguage, useSnackbar } from '@truth-platform/core-ui'
import { ref, watch } from 'vue'

import { createIndustry } from '@/requests/industries'
import { readCreator } from '@/utils/identity'

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { notify, reportError } = useSnackbar()
const { t } = useLanguage()

const name = ref<string>('')
const description = ref<string>('')
const saving = ref<boolean>(false)
const showErrors = ref<boolean>(false)

const close = () => {
  emit('update:modelValue', false)
}

const { confirmOpen, attemptClose, discard } = useDirtyGuard({
  isDirty: () => !saving.value && (name.value.trim().length > 0 || description.value.trim().length > 0),
  close,
})

/* A click outside the dialog or Escape asks to close it, which the guard answers. */
const onDialogModel = (open: boolean) => {
  if (!open) {
    attemptClose()
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      name.value = ''
      description.value = ''
      showErrors.value = false
    }
  },
)

const create = async () => {
  showErrors.value = true
  if (name.value.trim().length === 0) {
    return
  }

  saving.value = true
  try {
    const industryId = await createIndustry({
      name: name.value.trim(),
      description: description.value.trim(),
      creator: readCreator(),
    })

    notify(t('industry.created'), 'success')
    emit('created', industryId)
    close()
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.industry-form {
  background-color: rgb(var(--v-theme-surface));
}

.industry-form__title {
  padding-inline: 1.5rem;
  padding-block: 1.25rem 0.5rem;
  font-size: 1.375rem;
  font-weight: 700;
}

.industry-form__body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding-inline: 1.5rem;
}

.industry-form__actions {
  padding-inline: 1.5rem;
  padding-block: 0.75rem;
}
</style>
