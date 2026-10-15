<template>
  <div class="page">
    <PageHeader :eyebrow="t('assumption.badge')" :back-to="back.to" :back-label="back.label">
      <template #title>
        <span class="headline" :class="{ 'headline--long': headline.length > LONG_HEADLINE }">
          <LinkedText :text="headline" />
        </span>
      </template>
      <template v-if="detail" #actions>
        <v-btn variant="tonal" prepend-icon="mdi-link-variant" @click="copyLink">{{ t('assumption.copyLink') }}</v-btn>
        <v-btn color="primary" prepend-icon="mdi-content-copy" @click="duplicateOpen = true">{{ t('assumption.duplicate') }}</v-btn>
      </template>
    </PageHeader>

    <v-alert v-if="failed" type="error" variant="tonal" rounded="lg" :text="t('assumption.unreadable')" />

    <div v-else-if="detail === null" class="layout">
      <v-skeleton-loader type="article, table" class="surface" />
      <v-skeleton-loader type="list-item-two-line@5" class="surface" />
    </div>

    <div v-else class="layout">
      <div class="main">
        <section v-for="group in groups" :key="group.id" class="group">
          <header class="group__head">
            <h2 class="group__title">
              <v-icon icon="mdi-shape-outline" size="17" />
              <RouterLink v-if="group.id !== OTHER" :to="`/schemas/${group.id}`" class="bidi">{{ group.name }}</RouterLink>
              <span v-else>{{ t('assumption.attributes') }}</span>
            </h2>
          </header>
          <div class="surface attributes">
            <div v-for="item in group.items" :key="item.key" class="attribute">
              <div class="attribute__label bidi">{{ item.label }}</div>
              <div class="attribute__value bidi">
                <template v-if="Array.isArray(item.value)">
                  <span class="attribute__chips">
                    <ValueChip v-for="entry in item.value" :key="String(entry)" :label="formatValue(entry)" />
                  </span>
                </template>
                <span v-else-if="item.value === null || item.value === ''" class="text-muted">—</span>
                <LinkedText v-else :text="formatValue(item.value)" />
              </div>
            </div>
          </div>
        </section>

        <div v-if="groups.length === 0" class="surface">
          <EmptyState compact icon="mdi-tune-variant" :title="t('detail.noAttributes')" />
        </div>
      </div>

      <aside class="surface facts">
        <dl>
          <div class="fact">
            <dt>{{ t('column.proposingParty') }}</dt>
            <dd><ValueChip :label="detail.proposing_party" variant="dot" /></dd>
          </div>
          <div class="fact">
            <dt>{{ t('column.validationBy') }}</dt>
            <dd class="fact__chips">
              <ValueChip v-for="party in detail.validation_responsible_parties" :key="party" :label="party" variant="dot" />
              <span v-if="detail.validation_responsible_parties.length === 0" class="text-muted">—</span>
            </dd>
          </div>
          <div class="fact">
            <dt>{{ t('column.industries') }}</dt>
            <dd class="fact__chips">
              <RouterLink v-for="industry in detail.industries" :key="industry.id" :to="`/industries/${industry.id}`">
                <ValueChip :label="industry.name" clickable />
              </RouterLink>
            </dd>
          </div>
          <div class="fact">
            <dt>{{ t('column.tags') }}</dt>
            <dd class="fact__chips">
              <ValueChip v-for="tag in detail.tags" :key="tag" :label="tag" />
              <span v-if="detail.tags.length === 0" class="text-muted">—</span>
            </dd>
          </div>
          <v-divider class="my-1" />
          <div class="fact">
            <dt>{{ t('assumption.state') }}</dt>
            <dd>
              <ValueChip v-if="detail.deleted" :label="t('detail.removed')" color="error" />
              <ValueChip v-else-if="detail.archived" :label="t('detail.archived')" color="warning" />
              <ValueChip v-else :label="t('assumption.active')" color="success" />
            </dd>
          </div>
          <div class="fact">
            <dt>{{ t('column.revision') }}</dt>
            <dd class="tabular">{{ detail.revision }}</dd>
          </div>
          <div v-if="detail.revision_reason" class="fact">
            <dt>{{ t('assumption.reason') }}</dt>
            <dd class="bidi">{{ detail.revision_reason }}</dd>
          </div>
          <div class="fact">
            <dt>{{ t('column.creator') }}</dt>
            <dd class="bidi">{{ detail.creator }}</dd>
          </div>
          <div class="fact">
            <dt>{{ t('column.createdAt') }}</dt>
            <dd class="tabular">{{ formatDateTime(detail.created_at) }}</dd>
          </div>
        </dl>
      </aside>
    </div>

    <AssumptionFormDialog v-model="duplicateOpen" :initial="detail" @created="(newId) => router.push(`/assumptions/${newId}`)" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import AssumptionFormDialog from '@/features/assumptions/components/AssumptionFormDialog.vue'
import type { JsonValue } from '@/domain/json'
import type { AssumptionDetail } from '@/domain/models'
import { fieldLabel, readScheme } from '@/domain/scheme'
import { humanizeKey } from '@/domain/names'
import { useI18n } from '@/i18n'
import EmptyState from '@/shared/components/EmptyState.vue'
import LinkedText from '@/shared/components/LinkedText.vue'
import PageHeader from '@/shared/components/PageHeader.vue'
import ValueChip from '@/shared/components/ValueChip.vue'
import { formatDateTime, formatValue } from '@/shared/utils/format'
import { useNotifications } from '@/stores/notifications'
import { usePreferences } from '@/stores/preferences'
import { useRegisterStore } from '@/stores/register'

const OTHER = '__other__'
/** Past this many characters the statement is set smaller so the header stays readable. */
const LONG_HEADLINE = 140

interface AttributeGroup {
  id: string
  name: string
  items: { key: string; label: string; value: JsonValue }[]
}

const props = defineProps<{ id: string }>()

const { t, language } = useI18n()
const router = useRouter()
const register = useRegisterStore()
const preferences = usePreferences()
const { notify, reportError } = useNotifications()

const detail = shallowRef<AssumptionDetail | null>(null)
const failed = ref(false)
const duplicateOpen = ref(false)

watch(
  () => props.id,
  async (id) => {
    failed.value = false
    detail.value = register.findAssumption(id)?.detail ?? null
    try {
      detail.value = await register.refreshAssumption(id)
    } catch (error) {
      if (detail.value === null) failed.value = true
      reportError(error)
    }
  },
  { immediate: true },
)

const headline = computed(() => detail.value?.assumption_text.trim() || t('assumption.badge'))

/** Back to the register this assumption was opened from (its view intact), or to its first industry. */
const back = computed(() => {
  const industry = detail.value?.industries[0]
  if (industry === undefined) return { to: '/industries', label: t('industries.title') }

  return {
    to: preferences.registerPathFor(industry.id) ?? `/industries/${industry.id}`,
    label: t('assumption.back', { industry: industry.name }),
  }
})

/** Attributes grouped by the schema that declares them; values no schema declares are listed last. */
const groups = computed<AttributeGroup[]>(() => {
  const held = detail.value
  if (held === null) return []
  const seen = new Set<string>()
  const result: AttributeGroup[] = []

  for (const schema of held.schemas) {
    const items = readScheme(schema.scheme)
      .filter((field) => !seen.has(field.key))
      .map((field) => {
        seen.add(field.key)

        return { key: field.key, label: fieldLabel(field, language.value), value: held.values[field.key] ?? null }
      })
    if (items.length > 0) result.push({ id: schema.id, name: schema.name, items })
  }

  const rest = Object.entries(held.values)
    .filter(([key]) => !seen.has(key))
    .map(([key, value]) => ({ key, label: humanizeKey(key), value }))
  if (rest.length > 0) result.push({ id: OTHER, name: '', items: rest })

  return result
})

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    notify(t('assumption.linkCopied'), 'success')
  } catch (error) {
    reportError(error)
  }
}
</script>

<style scoped>
.headline {
  display: block;
  max-inline-size: 64rem;
}

.headline--long {
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1.45;
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  gap: 1.5rem;
  align-items: start;
}

@media (max-width: 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

.main {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.group__title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.85rem;
  font-weight: 650;
}

.group__title a {
  color: inherit;
  text-decoration: none;
}

.group__title a:hover {
  color: rgb(var(--v-theme-primary));
}

.attributes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 1px;
  overflow: hidden;
  background: rgb(var(--v-theme-border));
}

.attribute {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.9rem 1.1rem;
  background: rgb(var(--v-theme-surface));
}

.attribute__label {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-muted));
}

.attribute__value {
  font-size: 0.95rem;
  font-weight: 550;
  overflow-wrap: anywhere;
}

.attribute__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.facts {
  position: sticky;
  inset-block-start: 1.5rem;
  padding: 1.25rem;
}

.facts dl {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.fact dt {
  margin-block-end: 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-muted));
}

.fact dd {
  font-size: 0.875rem;
}

.fact__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.fact__chips a {
  text-decoration: none;
}
</style>
