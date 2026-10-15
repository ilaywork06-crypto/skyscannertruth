<template>
  <div class="page">
    <PageHeader back-to="/industries" :back-label="t('industries.title')">
      <template #title>
        <span class="title">
          <span class="title__dot" :style="{ background: `rgb(var(--v-theme-${chipColor(name)}))` }" />
          {{ name }}
        </span>
      </template>
      <template #subtitle>
        <span class="tabular">
          {{ count === 1 ? t('industries.assumptionsOne') : t('industries.assumptions', { count }) }}
          · {{ schemaCount === 1 ? t('industries.schemasOne') : t('industries.schemas', { count: schemaCount }) }}
        </span>
      </template>
    </PageHeader>

    <div v-if="missing" class="surface">
      <EmptyState icon="mdi-domain-off" :title="t('industry.notFound')">
        <v-btn variant="tonal" color="primary" to="/industries">{{ t('common.goHome') }}</v-btn>
      </EmptyState>
    </div>

    <RegisterView v-else :key="id" :industry-id="id" />
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

import RegisterView from '@/features/register/RegisterView.vue'
import { useI18n } from '@/i18n'
import EmptyState from '@/shared/components/EmptyState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import { chipColor } from '@/shared/utils/colors'
import { usePreferences } from '@/stores/preferences'
import { useRegisterStore } from '@/stores/register'

const props = defineProps<{ id: string }>()

const { t } = useI18n()
const register = useRegisterStore()
const preferences = usePreferences()

const industry = computed(() => register.findIndustry(props.id))
const name = computed(() => industry.value?.name ?? t('industry.unknown'))
const missing = computed(() => register.isReady && industry.value === undefined)
const count = computed(() => register.countsByIndustry.get(industry.value?.id ?? props.id) ?? 0)
const schemaCount = computed(() => register.schemasFor([props.id]).length)

/* Where the client reopens next time; an industry that turned out not to exist is forgotten. */
watch(
  [() => props.id, missing],
  ([id, gone]) => {
    preferences.lastIndustry = gone ? null : id
  },
  { immediate: true },
)
</script>

<style scoped>
.title {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.title__dot {
  inline-size: 0.75rem;
  block-size: 0.75rem;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgb(var(--v-theme-surface-light));
}
</style>
