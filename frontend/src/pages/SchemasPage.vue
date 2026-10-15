<template>
  <div class="page">
    <PageHeader :title="t('schemas.title')" :subtitle="t('schemas.subtitle')">
      <template #actions>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="createOpen = true">{{ t('schemas.new') }}</v-btn>
      </template>
    </PageHeader>

    <div class="filters">
      <v-text-field v-model="search" class="filters__search" :placeholder="t('schemas.search')" prepend-inner-icon="mdi-magnify" density="compact" clearable />
      <v-select
        v-model="industryId"
        class="filters__industry"
        :items="industryItems"
        prepend-inner-icon="mdi-domain"
        density="compact"
      />
    </div>

    <div v-if="loading" class="grid">
      <v-skeleton-loader v-for="index in 6" :key="index" type="article" class="surface" />
    </div>

    <div v-else-if="register.schemas.length === 0" class="surface">
      <EmptyState icon="mdi-shape-outline" :title="t('schemas.empty')" :text="t('schemas.emptyHint')">
        <v-btn color="primary" prepend-icon="mdi-plus" @click="createOpen = true">{{ t('schemas.new') }}</v-btn>
      </EmptyState>
    </div>

    <p v-else-if="shown.length === 0" class="text-muted">{{ t('schemas.noMatch', { term: search }) }}</p>

    <div v-else class="grid">
      <SchemaCard
        v-for="schema in shown"
        :key="schema.id"
        :schema="schema"
        :detail="register.schemaDetails.get(schema.id)"
        :usage="register.countsBySchema.get(schema.id) ?? 0"
      />
    </div>

    <SchemaFormDialog v-model="createOpen" @saved="(id) => router.push(`/schemas/${id}`)" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { schemaAppliesTo } from '@/domain/models'
import { readScheme } from '@/domain/scheme'
import SchemaCard from '@/features/schemas/components/SchemaCard.vue'
import SchemaFormDialog from '@/features/schemas/components/SchemaFormDialog.vue'
import { useI18n } from '@/i18n'
import EmptyState from '@/shared/components/EmptyState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import { useRegisterStore } from '@/stores/register'

const ALL = ''

const { t } = useI18n()
const router = useRouter()
const register = useRegisterStore()

const createOpen = ref(false)
const search = ref('')
const industryId = ref(ALL)

const loading = computed(() => register.state === 'loading' || register.state === 'idle')

const industryItems = computed(() => [
  { title: t('schemas.filterIndustry'), value: ALL },
  ...register.industries.map((industry) => ({ title: industry.name, value: industry.id })),
])

/** Searched across the name, the description and every attribute's key and names. */
const shown = computed(() => {
  const needle = (search.value ?? '').trim().toLowerCase()

  return [...register.schemas]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((schema) => {
      const detail = register.schemaDetails.get(schema.id)
      if (industryId.value !== ALL && (detail === undefined || !schemaAppliesTo(detail, [industryId.value]))) {
        return false
      }
      if (needle.length === 0) return true
      const haystack = [
        schema.name,
        detail?.description ?? '',
        ...readScheme(detail?.scheme).flatMap((field) => [field.key, field.displayName, field.displayNameHebrew]),
      ]

      return haystack.join(' ').toLowerCase().includes(needle)
    })
})
</script>

<style scoped>
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.filters__search {
  flex: 0 1 24rem;
  min-inline-size: 14rem;
}

.filters__industry {
  flex: 0 1 16rem;
  min-inline-size: 12rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
  gap: 1rem;
}
</style>
