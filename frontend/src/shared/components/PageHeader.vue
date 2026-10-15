<template>
  <header class="page-header">
    <div class="page-header__main">
      <RouterLink v-if="backTo" :to="backTo" class="page-header__back">
        <v-icon :icon="isRtl ? 'mdi-arrow-right' : 'mdi-arrow-left'" size="16" />
        <span>{{ backLabel }}</span>
      </RouterLink>
      <div v-if="eyebrow" class="page-header__eyebrow">
        <slot name="eyebrow">{{ eyebrow }}</slot>
      </div>
      <h1 class="page-header__title bidi">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="subtitle || $slots.subtitle" class="page-header__subtitle">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { RouterLink } from 'vue-router'

import { useI18n } from '@/i18n'

defineProps<{
  title?: string
  subtitle?: string
  eyebrow?: string
  backTo?: RouteLocationRaw
  backLabel?: string
}>()

const { isRtl } = useI18n()
</script>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem 2rem;
}

.page-header__main {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-inline-size: 0;
  flex: 1 1 24rem;
}

.page-header__back {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  inline-size: fit-content;
  margin-block-end: 0.35rem;
  color: rgb(var(--v-theme-muted));
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.15s;
}

.page-header__back:hover {
  color: rgb(var(--v-theme-primary));
}

.page-header__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-primary));
}

.page-header__title {
  font-size: clamp(1.5rem, 2.4vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.page-header__subtitle {
  max-inline-size: 48rem;
  color: rgb(var(--v-theme-muted));
  font-size: 0.9375rem;
}

.page-header__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}
</style>
