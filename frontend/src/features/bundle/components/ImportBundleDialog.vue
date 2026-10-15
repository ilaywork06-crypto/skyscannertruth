<template>
  <FormDialog
    :model-value="modelValue"
    :title="t('import.title')"
    :subtitle="t('import.note')"
    icon="mdi-tray-arrow-up"
    max-width="38rem"
    :submit-label="finished ? '' : t('import.restore')"
    :cancel-label="finished ? t('common.close') : undefined"
    :saving="running"
    :submit-disabled="plan.total === 0"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="run"
  >
    <label
      class="dropzone"
      :class="{ 'dropzone--over': dragging, 'dropzone--error': unreadable }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input type="file" accept="application/json,.json" class="dropzone__input" :disabled="running" @change="onFile">
      <v-icon :icon="bundle ? 'mdi-package-variant-closed-check' : 'mdi-cloud-upload-outline'" size="32" />
      <span class="dropzone__text">{{ fileName || t('import.drop') }}</span>
    </label>

    <v-alert v-if="unreadable" type="error" variant="tonal" density="compact" class="mt-4" :text="t('import.unreadable')" />

    <template v-if="bundle">
      <div class="plan">
        <div class="plan__item">
          <span class="plan__n tabular">{{ plan.industries.length }}</span>
          <span class="plan__label">{{ t('import.industries') }}</span>
        </div>
        <div class="plan__item">
          <span class="plan__n tabular">{{ plan.schemas.length }}</span>
          <span class="plan__label">{{ t('import.schemas') }}</span>
        </div>
        <div class="plan__item">
          <span class="plan__n tabular">{{ plan.assumptions.length }}</span>
          <span class="plan__label">{{ t('import.assumptions') }}</span>
        </div>
      </div>
      <p class="plan__caption">{{ plan.total === 0 ? t('import.nothing') : t('import.willCreate') }}</p>
      <p v-if="plan.skipped > 0" class="plan__caption">{{ t('import.alreadyHere', { count: plan.skipped }) }}</p>
    </template>

    <div v-if="running || finished" class="progress">
      <v-progress-linear :model-value="progress" color="primary" height="6" rounded />
      <span class="progress__text">
        <template v-if="running">{{ t('import.running', { done, total }) }}</template>
        <template v-else-if="failures.length === 0">{{ t('import.doneClean', { created, total }) }}</template>
        <template v-else>{{ t('import.done', { created, total, failed: failures.length }) }}</template>
      </span>
    </div>

    <v-alert v-if="failures.length > 0" type="warning" variant="tonal" density="compact" class="mt-3" :title="t('import.failures')">
      <ul class="failures">
        <li v-for="failure in failures" :key="failure" class="bidi">{{ failure }}</li>
      </ul>
    </v-alert>
  </FormDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

import { useI18n } from '@/i18n'
import FormDialog from '@/shared/components/FormDialog.vue'
import { useNotifications } from '@/stores/notifications'

import { useBundleRestore } from '../composables/useBundleRestore'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [open: boolean]; restored: [] }>()

const { t } = useI18n()
const { notify } = useNotifications()
const { bundle, fileName, unreadable, plan, running, finished, done, created, total, failures, progress, reset, pick, restore } =
  useBundleRestore()

const dragging = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (open) reset()
  },
)

const onFile = (event: Event) => void pick((event.target as HTMLInputElement).files?.[0] ?? null)

const onDrop = (event: DragEvent) => {
  dragging.value = false
  void pick(event.dataTransfer?.files[0] ?? null)
}

const run = async () => {
  await restore()
  if (created.value > 0) emit('restored')
  notify(
    failures.value.length === 0
      ? t('import.doneClean', { created: created.value, total: total.value })
      : t('import.done', { created: created.value, total: total.value, failed: failures.value.length }),
    failures.value.length === 0 ? 'success' : 'warning',
  )
}
</script>

<style scoped>
.dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: 2rem 1rem;
  border: 1.5px dashed rgb(var(--v-theme-border-strong));
  border-radius: 14px;
  background: rgb(var(--v-theme-surface-light));
  color: rgb(var(--v-theme-muted));
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.dropzone:hover,
.dropzone--over {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
  color: rgb(var(--v-theme-primary));
}

.dropzone--error {
  border-color: rgb(var(--v-theme-error));
}

.dropzone__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.dropzone__text {
  font-size: 0.875rem;
  font-weight: 500;
}

.plan {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.6rem;
  margin-block-start: 1.25rem;
}

.plan__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.8rem;
  border-radius: 12px;
  border: 1px solid rgb(var(--v-theme-border));
}

.plan__n {
  font-size: 1.5rem;
  font-weight: 700;
}

.plan__label,
.plan__caption {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}

.plan__caption {
  margin-block-start: 0.6rem;
}

.progress {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-block-start: 1.25rem;
}

.progress__text {
  font-size: 0.8125rem;
}

.failures {
  padding-inline-start: 1rem;
  font-size: 0.8125rem;
}
</style>
