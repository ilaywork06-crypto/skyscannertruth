<template>
  <RouterLink :to="`/industries/${industry.id}`" class="industry-card surface" :style="{ '--accent': `var(--v-theme-${color})` }">
    <div class="industry-card__glow" />
    <header class="industry-card__head">
      <div class="industry-card__avatar">{{ initials(industry.name) }}</div>
      <v-icon class="industry-card__arrow" :icon="isRtl ? 'mdi-arrow-left' : 'mdi-arrow-right'" size="18" />
    </header>
    <h3 class="industry-card__name bidi">{{ industry.name }}</h3>
    <div class="industry-card__stats">
      <span class="industry-card__count tabular">
        <template v-if="counting && assumptions === 0">{{ t('industries.counting') }}</template>
        <template v-else>{{ assumptions === 1 ? t('industries.assumptionsOne') : t('industries.assumptions', { count: assumptions }) }}</template>
      </span>
      <span class="industry-card__dot">·</span>
      <span>{{ schemas === 1 ? t('industries.schemasOne') : t('industries.schemas', { count: schemas }) }}</span>
    </div>
    <v-progress-linear v-if="counting" indeterminate color="primary" height="2" class="industry-card__progress" />
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { Industry } from '@/domain/models'
import { useI18n } from '@/i18n'
import { chipColor, initials } from '@/shared/utils/colors'

const props = defineProps<{ industry: Industry; assumptions: number; schemas: number; counting: boolean }>()

const { t, isRtl } = useI18n()
const color = computed(() => chipColor(props.industry.name))
</script>

<style scoped>
.industry-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 1.2rem 1.25rem 1.1rem;
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.18s, transform 0.18s, box-shadow 0.18s;
}

.industry-card:hover {
  border-color: rgba(var(--accent), 0.55);
  transform: translateY(-2px);
  box-shadow: var(--truth-shadow);
}

.industry-card__glow {
  position: absolute;
  inset-block-start: -40%;
  inset-inline-end: -20%;
  inline-size: 60%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(var(--accent), 0.18), transparent 70%);
  pointer-events: none;
}

.industry-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-block-end: 0.5rem;
}

.industry-card__avatar {
  display: grid;
  place-items: center;
  inline-size: 2.6rem;
  block-size: 2.6rem;
  border-radius: 12px;
  background: rgba(var(--accent), 0.16);
  color: rgb(var(--accent));
  font-weight: 700;
  font-size: 0.9rem;
}

.industry-card__arrow {
  color: rgb(var(--v-theme-muted));
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.18s;
}

[dir='rtl'] .industry-card__arrow {
  transform: translateX(4px);
}

.industry-card:hover .industry-card__arrow {
  opacity: 1;
  transform: none;
  color: rgb(var(--accent));
}

.industry-card__name {
  font-size: 1.1rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.industry-card__stats {
  display: flex;
  gap: 0.4rem;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}

.industry-card__count {
  color: rgb(var(--v-theme-on-surface));
  font-weight: 500;
}

.industry-card__progress {
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
}
</style>
