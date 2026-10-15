<template>
  <div class="page">
    <PageHeader :title="t('industries.title')" :subtitle="t('industries.subtitle')">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="createOpen = true">{{ t('industries.new') }}</v-btn>
      </template>
    </PageHeader>

    <div class="stats">
      <StatTile icon="mdi-domain" :label="t('industries.totalIndustries')" :value="register.industries.length" :loading="loading" />
      <StatTile icon="mdi-lightbulb-on-outline" :label="t('industries.totalAssumptions')" :value="register.assumptions.length" :loading="loading" />
      <StatTile icon="mdi-shape-outline" :label="t('industries.totalSchemas')" :value="register.schemas.length" :loading="loading" />
    </div>

    <v-text-field
      v-if="register.industries.length > 6"
      v-model="search"
      class="search"
      :placeholder="t('industries.search')"
      prepend-inner-icon="mdi-magnify"
      density="compact"
      clearable
    />

    <div v-if="loading" class="grid">
      <v-skeleton-loader v-for="index in 6" :key="index" type="article" class="surface" />
    </div>

    <div v-else-if="register.industries.length === 0" class="surface">
      <EmptyState icon="mdi-domain" :title="t('industries.empty')" :text="t('industries.emptyHint')">
        <v-btn color="primary" prepend-icon="mdi-plus" @click="createOpen = true">{{ t('industries.new') }}</v-btn>
      </EmptyState>
    </div>

    <p v-else-if="shown.length === 0" class="text-muted">{{ t('industries.noMatch', { term: search }) }}</p>

    <div v-else class="grid">
      <IndustryCard
        v-for="industry in shown"
        :key="industry.id"
        :industry="industry"
        :assumptions="register.countsByIndustry.get(industry.id) ?? 0"
        :schemas="register.schemasFor([industry.id]).length"
        :counting="register.completing"
      />
    </div>

    <IndustryFormDialog v-model="createOpen" @created="(id) => router.push(`/industries/${id}`)" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import IndustryCard from '@/features/industries/components/IndustryCard.vue'
import IndustryFormDialog from '@/features/industries/components/IndustryFormDialog.vue'
import { useI18n } from '@/i18n'
import EmptyState from '@/shared/components/EmptyState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import StatTile from '@/shared/components/StatTile.vue'
import { useRegisterStore } from '@/stores/register'

const { t } = useI18n()
const router = useRouter()
const register = useRegisterStore()

const createOpen = ref(false)
const search = ref('')

const loading = computed(() => register.state === 'loading' || register.state === 'idle')

const shown = computed(() => {
  const needle = (search.value ?? '').trim().toLowerCase()

  return [...register.industries]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((industry) => needle.length === 0 || industry.name.toLowerCase().includes(needle))
})
</script>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 1rem;
}

.search {
  max-inline-size: 22rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1rem;
}
</style>
