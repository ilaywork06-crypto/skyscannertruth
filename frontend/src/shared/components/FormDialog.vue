<template>
  <v-dialog
    :model-value="modelValue"
    :max-width="maxWidth"
    scrollable
    :persistent="saving"
    @update:model-value="onModel"
  >
    <v-card class="form-dialog">
      <header class="form-dialog__header">
        <div v-if="icon" class="form-dialog__icon"><v-icon :icon="icon" size="22" /></div>
        <div class="form-dialog__heading">
          <h2 class="form-dialog__title bidi">{{ title }}</h2>
          <p v-if="subtitle" class="form-dialog__subtitle">{{ subtitle }}</p>
        </div>
        <v-btn icon="mdi-close" variant="text" size="small" :aria-label="t('common.close')" :disabled="saving" @click="attemptClose" />
      </header>

      <v-card-text class="form-dialog__body">
        <form :id="formId" novalidate @submit.prevent="emit('submit')">
          <slot />
        </form>
      </v-card-text>

      <footer class="form-dialog__footer">
        <slot name="footer-start" />
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="attemptClose">{{ cancelLabel ?? t('common.cancel') }}</v-btn>
        <v-btn
          v-if="submitLabel"
          color="primary"
          type="submit"
          :form="formId"
          :loading="saving"
          :disabled="saving || submitDisabled"
        >
          {{ submitLabel }}
        </v-btn>
      </footer>
    </v-card>
  </v-dialog>

  <v-dialog v-model="confirmOpen" max-width="26rem">
    <v-card class="pa-2">
      <v-card-title class="text-h6">{{ t('common.unsavedTitle') }}</v-card-title>
      <v-card-text class="text-muted">{{ t('common.unsavedBody') }}</v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="confirmOpen = false">{{ t('common.keepEditing') }}</v-btn>
        <v-btn color="error" variant="tonal" @click="discard">{{ t('common.discard') }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'

import { useI18n } from '@/i18n'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title: string
    subtitle?: string
    icon?: string
    maxWidth?: string
    submitLabel?: string
    cancelLabel?: string
    saving?: boolean
    submitDisabled?: boolean
    /** Whether closing would lose work - asks first when it would. */
    dirty?: boolean
  }>(),
  { subtitle: '', icon: '', maxWidth: '40rem', submitLabel: '', cancelLabel: undefined, saving: false, submitDisabled: false, dirty: false },
)

const emit = defineEmits<{ 'update:modelValue': [open: boolean]; submit: [] }>()

const { t } = useI18n()
const formId = `form-${useId()}`
const confirmOpen = ref(false)

const close = () => emit('update:modelValue', false)

const attemptClose = () => {
  if (props.saving) {
    return
  }
  if (props.dirty) {
    confirmOpen.value = true

    return
  }
  close()
}

const discard = () => {
  confirmOpen.value = false
  close()
}

const onModel = (open: boolean) => {
  if (!open) {
    attemptClose()
  }
}
</script>

<style scoped>
.form-dialog {
  background: rgb(var(--v-theme-surface)) !important;
}

.form-dialog__header {
  display: flex;
  align-items: flex-start;
  gap: 0.9rem;
  padding: 1.4rem 1.25rem 1rem 1.5rem;
}

.form-dialog__icon {
  display: grid;
  place-items: center;
  inline-size: 2.6rem;
  block-size: 2.6rem;
  flex: none;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
}

.form-dialog__heading {
  flex: 1;
  min-inline-size: 0;
}

.form-dialog__title {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.form-dialog__subtitle {
  margin-block-start: 0.15rem;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-muted));
}

.form-dialog__body {
  padding: 0.5rem 1.5rem 1.5rem !important;
}

.form-dialog__footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.9rem 1.5rem;
  border-top: 1px solid rgb(var(--v-theme-border));
  background: rgb(var(--v-theme-surface-bright));
}
</style>
