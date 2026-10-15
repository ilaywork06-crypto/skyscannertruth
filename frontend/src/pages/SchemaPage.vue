<template>
  <div class="page">
    <PageHeader :eyebrow="t('schemas.badge')" back-to="/schemas" :back-label="t('schemas.back')">
      <template #title>{{ detail?.name ?? summary?.name ?? '…' }}</template>
      <template v-if="detail" #subtitle>
        {{ t('schemas.declaredBy', { creator: detail.creator, moment: formatDateTime(detail.created_at) }) }}
      </template>
      <template v-if="detail" #actions>
        <v-btn color="primary" prepend-icon="mdi-source-branch" @click="reviseOpen = true">{{ t('schemas.revise') }}</v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="failed" type="error" variant="tonal" rounded="lg" :text="t('schemas.unreadable')" />

    <v-skeleton-loader v-else-if="detail === null" type="article, table" class="surface" />

    <template v-else>
      <div class="overview">
        <div class="surface tile">
          <span class="tile__label">{{ t('column.revision') }}</span>
          <span class="tile__value tabular">{{ detail.revision }}</span>
        </div>
        <div class="surface tile">
          <span class="tile__label">{{ t('schemas.attributes') }}</span>
          <span class="tile__value tabular">{{ fields.length }}</span>
        </div>
        <div class="surface tile">
          <span class="tile__label">{{ t('schemas.usedBy') }}</span>
          <span class="tile__value tabular">{{ register.countsBySchema.get(detail.id) ?? 0 }}</span>
        </div>
        <div class="surface tile tile--wide">
          <span class="tile__label">{{ t('column.industries') }}</span>
          <span class="tile__chips">
            <ValueChip v-if="appliesEverywhere(detail)" :label="t('schemas.allIndustries')" neutral variant="outline" />
            <RouterLink v-for="industry in detail.industries" :key="industry.id" :to="`/industries/${industry.id}`">
              <ValueChip :label="industry.name" clickable />
            </RouterLink>
          </span>
        </div>
      </div>

      <section v-if="detail.description || detail.revision_reason" class="surface notes">
        <p v-if="detail.description" class="notes__description bidi">{{ detail.description }}</p>
        <p v-if="detail.revision_reason" class="notes__reason">
          <v-icon icon="mdi-history" size="16" />
          <strong>{{ t('schemas.lastReason') }}:</strong>
          <span class="bidi">{{ detail.revision_reason }}</span>
        </p>
      </section>

      <AttributesTable v-if="fields.length > 0" :fields="fields" />
      <div v-else class="surface">
        <EmptyState compact icon="mdi-shape-outline" :title="t('schemas.noAttributes')" />
      </div>
    </template>

    <SchemaFormDialog v-model="reviseOpen" :schema="detail" @saved="reload" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { RouterLink } from 'vue-router'

import type { SchemaDetail } from '@/domain/models'
import { appliesEverywhere } from '@/domain/models'
import { readScheme } from '@/domain/scheme'
import AttributesTable from '@/features/schemas/components/AttributesTable.vue'
import SchemaFormDialog from '@/features/schemas/components/SchemaFormDialog.vue'
import { useI18n } from '@/i18n'
import EmptyState from '@/shared/components/EmptyState.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ValueChip from '@/shared/components/ValueChip.vue'
import { formatDateTime } from '@/shared/utils/format'
import { useNotifications } from '@/stores/notifications'
import { useRegisterStore } from '@/stores/register'

const props = defineProps<{ id: string }>()

const { t } = useI18n()
const register = useRegisterStore()
const { reportError } = useNotifications()

const detail = shallowRef<SchemaDetail | null>(null)
const failed = ref(false)
const reviseOpen = ref(false)

const summary = computed(() => register.schemas.find((schema) => schema.id === props.id))
const fields = computed(() => readScheme(detail.value?.scheme))

const reload = async () => {
  failed.value = false
  try {
    detail.value = await register.refreshSchema(props.id)
  } catch (error) {
    failed.value = detail.value === null
    reportError(error)
  }
}

watch(
  () => props.id,
  (id) => {
    detail.value = register.schemaDetails.get(id) ?? null
    if (detail.value === null) void reload()
  },
  { immediate: true },
)

/* The register may finish loading after the page opened. */
watch(
  () => register.schemaDetails.get(props.id),
  (held) => {
    if (held !== undefined) detail.value = held
  },
)
</script>

<style scoped>
.overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(8rem, 1fr)) minmax(16rem, 2fr);
  gap: 1rem;
}

@media (max-width: 900px) {
  .overview {
    grid-template-columns: repeat(3, 1fr);
  }

  .tile--wide {
    grid-column: 1 / -1;
  }
}

.tile {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 1rem 1.2rem;
}

.tile__label {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-muted));
}

.tile__value {
  font-size: 1.5rem;
  font-weight: 700;
}

.tile__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.tile__chips a {
  text-decoration: none;
}

.notes {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.1rem 1.25rem;
}

.notes__description {
  font-size: 0.9375rem;
}

.notes__reason {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}
</style>
