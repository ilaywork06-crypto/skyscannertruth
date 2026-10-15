<template>
  <div class="toasts" role="status" aria-live="polite">
    <transition-group name="toast">
      <div v-for="toast in notifications.toasts" :key="toast.id" class="toast" :class="`toast--${toast.tone}`">
        <v-icon :icon="ICONS[toast.tone]" size="20" class="toast__icon" />
        <span class="toast__text bidi">{{ toast.text }}</span>
        <v-btn icon="mdi-close" size="x-small" variant="text" :aria-label="t('common.close')" @click="notifications.dismiss(toast.id)" />
      </div>
    </transition-group>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'
import { useNotifications, type Tone } from '@/stores/notifications'

const ICONS: Record<Tone, string> = {
  success: 'mdi-check-circle',
  info: 'mdi-information',
  warning: 'mdi-alert',
  error: 'mdi-alert-circle',
}

const notifications = useNotifications()
const { t } = useI18n()
</script>

<style scoped>
.toasts {
  position: fixed;
  inset-block-end: 1.5rem;
  inset-inline-end: 1.5rem;
  z-index: 3000;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-inline-size: min(26rem, calc(100vw - 2rem));
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 0.75rem 0.75rem 1rem;
  border-radius: 12px;
  background: rgb(var(--v-theme-surface-bright));
  border: 1px solid rgb(var(--v-theme-border-strong));
  box-shadow: 0 16px 40px -12px rgb(0 0 0 / 0.5);
  font-size: 0.875rem;
}

.toast__text {
  flex: 1;
}

.toast--success .toast__icon { color: rgb(var(--v-theme-success)); }
.toast--info .toast__icon { color: rgb(var(--v-theme-info)); }
.toast--warning .toast__icon { color: rgb(var(--v-theme-warning)); }
.toast--error .toast__icon { color: rgb(var(--v-theme-error)); }

.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
