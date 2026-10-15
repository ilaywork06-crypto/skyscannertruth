<template>
  <RouterLink to="/industries" class="brand" :aria-label="t('app.name')">
    <svg class="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="rgb(var(--v-theme-primary))" />
          <stop offset="1" stop-color="rgb(var(--v-theme-secondary))" />
        </linearGradient>
      </defs>
      <path d="M16 4 L28 10.5 L16 17 L4 10.5 Z" fill="url(#brand-gradient)" />
      <path d="M4 16 L16 22.5 L28 16" fill="none" stroke="url(#brand-gradient)" stroke-width="2.4" stroke-linejoin="round" opacity="0.7" />
      <path d="M4 21.5 L16 28 L28 21.5" fill="none" stroke="url(#brand-gradient)" stroke-width="2.4" stroke-linejoin="round" opacity="0.4" />
    </svg>
    <span v-if="!compact" class="brand__text">
      <span class="brand__name">TRUTH</span>
      <span class="brand__tagline">{{ t('app.tagline') }}</span>
    </span>
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { useI18n } from '@/i18n'

defineProps<{ compact?: boolean }>()

const { t } = useI18n()
</script>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  color: inherit;
  text-decoration: none;
}

.brand__mark {
  inline-size: 2rem;
  block-size: 2rem;
  flex: none;
}

.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.brand__name {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.32em;
}

.brand__tagline {
  font-size: 0.7rem;
  color: rgb(var(--v-theme-muted));
  letter-spacing: 0.02em;
}
</style>
