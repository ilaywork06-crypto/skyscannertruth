<template>
  <div class="sky-page">
    <AppHeader :industries="industries" />

    <div class="sky-page__content assumption">
      <div class="assumption__heading">
        <span class="assumption__badge">{{ t('assumption.badge') }}</span>
        <div class="assumption__heading-row">
          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            :aria-label="t('assumption.back')"
            :title="t('assumption.back')"
            :to="backTo"
          />
          <!-- The assumption is what the page is about, so it is the heading rather than a name beside it. -->
          <h1
            class="assumption__title"
            dir="auto"
          >
            <UiLinkedText :text="detail?.assumption_text ?? t('column.assumptionText')" />
          </h1>
        </div>
      </div>

      <div
        v-if="loading"
        class="assumption__loading"
      >
        <v-progress-circular
          indeterminate
          color="primary"
        />
      </div>

      <v-alert
        v-else-if="detail === null"
        type="error"
        variant="tonal"
      >
        {{ errorMessage }}
      </v-alert>

      <template v-else>
        <section class="assumption__facts">
          <div class="assumption__fact">
            <span class="assumption__fact-label">{{ t('column.industry') }}</span>
            <span class="assumption__fact-chips">
              <UiChip
                v-for="industry in detail.industries"
                :key="industry.id"
                :label="industry.name"
                :token="hashedToken(industry.name)"
              />
              <span v-if="detail.industries.length === 0">{{ EMPTY_PLACEHOLDER }}</span>
            </span>
          </div>
          <div class="assumption__fact">
            <span class="assumption__fact-label">{{ t('column.proposingParty') }}</span>
            <span
              class="assumption__fact-value"
              dir="auto"
            ><UiLinkedText :text="detail.proposing_party || EMPTY_PLACEHOLDER" /></span>
          </div>
          <div class="assumption__fact">
            <span class="assumption__fact-label">{{ t('column.validationBy') }}</span>
            <span class="assumption__fact-chips">
              <UiChip
                v-for="party in detail.validation_responsible_parties"
                :key="party"
                :label="party"
                token="chip-neutral"
              />
              <span v-if="detail.validation_responsible_parties.length === 0">{{ EMPTY_PLACEHOLDER }}</span>
            </span>
          </div>
          <div class="assumption__fact">
            <span class="assumption__fact-label">{{ t('column.tags') }}</span>
            <span class="assumption__fact-chips">
              <UiChip
                v-for="tag in detail.tags"
                :key="tag"
                :label="tag"
                token="chip-neutral"
              />
              <span v-if="detail.tags.length === 0">{{ EMPTY_PLACEHOLDER }}</span>
            </span>
          </div>
          <div
            v-if="stateLabel.length > 0"
            class="assumption__fact"
          >
            <span class="assumption__fact-label">{{ t('detail.state') }}</span>
            <UiChip
              :label="stateLabel"
              token="status-negative"
            />
          </div>

          <div class="assumption__fact assumption__fact--stamp">
            <span class="assumption__fact-label">{{ t('column.revision') }}</span>
            <span
              class="assumption__fact-value"
              dir="auto"
            >
              {{ detail.revision }}<template v-if="detail.revision_reason.length > 0"> · <UiLinkedText :text="detail.revision_reason" /></template>
            </span>
          </div>
          <div class="assumption__fact assumption__fact--stamp">
            <span class="assumption__fact-label">{{ t('column.createdAt') }}</span>
            <span class="assumption__fact-value">
              <span dir="ltr">{{ formatDateTime(detail.created_at) }}</span>
              <span class="assumption__muted">· {{ detail.creator }}</span>
            </span>
          </div>
        </section>

        <!--
          The attributes, one line apiece: what the attribute is called, the value, and the schema that asked
          for it - which is what tells a reader why the assumption carries it at all.
        -->
        <section class="assumption__panel">
          <SectionHeader
            icon="mdi-table-cog"
            :title="t('schemas.attributes')"
            :count="lines.length"
          >
            <v-btn
              v-for="schema in detail.schemas"
              :key="schema.id"
              class="assumption__schema-link"
              variant="text"
              size="small"
              prepend-icon="mdi-open-in-new"
              :to="`/schemas/${schema.id}`"
            >
              {{ schema.name }}
            </v-btn>
          </SectionHeader>

          <div
            v-if="lines.length > 0"
            class="assumption__frame"
            :dir="direction"
          >
            <table class="assumption__table">
              <thead>
                <tr>
                  <th>{{ t('assumption.attribute') }}</th>
                  <th>{{ t('assumption.value') }}</th>
                  <th v-if="severalSchemas">
                    {{ t('assumption.schema') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="line in lines"
                  :key="line.column.colId"
                >
                  <th scope="row">
                    <span
                      class="assumption__attribute"
                      dir="auto"
                    >{{ line.column.headerName }}</span>
                    <code
                      class="assumption__key"
                      dir="ltr"
                    >{{ line.column.colId }}</code>
                  </th>
                  <td>
                    <DynamicCell
                      :column="line.column"
                      :row="valuesRow"
                    />
                  </td>
                  <td v-if="severalSchemas">
                    <UiChip
                      :label="line.schema"
                      :token="hashedToken(line.schema)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-else
            class="assumption__muted"
          >
            {{ t('schemas.noAttributes') }}
          </p>
        </section>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import type { GeneratedColumn } from '@truth-platform/core-ui'

/** One attribute of the assumption: the column it is rendered through and the schema that declared it. */
interface AttributeLine {
  column: GeneratedColumn
  schema: string
}
</script>

<script setup lang="ts">
import {
  DynamicCell,
  EMPTY_PLACEHOLDER,
  SectionHeader,
  UiChip,
  formatDateTime,
  hashedToken,
  useLanguage,
  type GridRow,
  type JsonValue,
  UiLinkedText,
} from '@truth-platform/core-ui'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import { useRegister } from '@/composables/useRegister'
import type { AssumptionDetail } from '@/models/assumption'
import { readLatestAssumption } from '@/requests/assumptions'
import { fieldColumn } from '@/utils/columns'
import { readLastIndustry } from '@/utils/last-industry'
import { readScheme } from '@/utils/scheme'

const { t, direction } = useLanguage()

const route = useRoute('/assumptions/[id]')
const { industries } = useRegister()

const detail = ref<AssumptionDetail | null>(null)
const loading = ref<boolean>(true)
const errorMessage = ref<string>('')

const assumptionId = computed<string>(() => route.params.id)

/**
 * Read the assumption this page is showing, whenever the address changes to a different one.
 */
const load = async (): Promise<void> => {
  loading.value = true
  errorMessage.value = ''
  try {
    detail.value = await readLatestAssumption(assumptionId.value)
  } catch (error) {
    detail.value = null
    errorMessage.value = error instanceof Error ? error.message : t('assumption.unreadable')
  } finally {
    loading.value = false
  }
}

watch(assumptionId, () => void load(), { immediate: true })

/*
 * Back leads to the table the assumption was opened from: the industry last read, when the assumption is filed
 * under it, or else the first industry the assumption is filed under.
 */
const backTo = computed<string>(() => {
  const filed = detail.value?.industries ?? []
  const last = readLastIndustry()
  const home = filed.find((industry) => industry.id === last) ?? filed[0]

  return home === undefined ? '/industries' : `/industries/${home.id}`
})

/* An assumption in force says nothing about it; only one that was archived or removed is marked. */
const stateLabel = computed<string>(() => {
  if (detail.value?.deleted === true) {
    return t('detail.removed')
  }

  return detail.value?.archived === true ? t('detail.archived') : ''
})

/* Every attribute of every schema of the assumption, each key once. */
const lines = computed<AttributeLine[]>(() => {
  const seen = new Set<string>()
  const collected: AttributeLine[] = []
  ;(detail.value?.schemas ?? []).forEach((schema) => {
    readScheme(schema.scheme).fields.forEach((field) => {
      if (!seen.has(field.key)) {
        seen.add(field.key)
        collected.push({ column: fieldColumn(field), schema: schema.name })
      }
    })
  })

  return collected
})

/* Which schema asked for an attribute is only worth a column when there is more than one to tell apart. */
const severalSchemas = computed<boolean>(() => (detail.value?.schemas.length ?? 0) > 1)

/* The values as the columns address them. */
const valuesRow = computed<GridRow>(() => ({
  id: assumptionId.value,
  values: (detail.value?.values ?? {}) as JsonValue,
}))
</script>

<style scoped>
.assumption {
  gap: 1.25rem;
}

.assumption__heading {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-block-start: 0.5rem;
}

.assumption__badge {
  align-self: flex-start;
  margin-inline-start: 2.5rem;
  background-color: rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 0.375rem;
  padding-inline: 0.625rem;
  padding-block: 0.125rem;
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
}

.assumption__heading-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.assumption__title {
  flex: 1 1 auto;
  min-inline-size: 0;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.assumption__loading {
  display: flex;
  justify-content: center;
  padding-block: 3rem;
}

.assumption__facts {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem 2rem;
  background-color: rgb(var(--v-theme-surface));
  border-radius: 0.5rem;
  padding: 1rem 1.5rem;
}

.assumption__fact {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-inline-size: 0;
}

.assumption__fact-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
}

.assumption__fact-value {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-block-size: 1.5rem;
  font-size: 0.9375rem;
}

.assumption__fact-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

/* The two things the record says about itself close the row, one step quieter than the facts before them. */
.assumption__fact--stamp {
  opacity: 0.85;
}

.assumption__fact:not(.assumption__fact--stamp) + .assumption__fact--stamp {
  margin-inline-start: auto;
}

.assumption__panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background-color: rgb(var(--v-theme-surface));
  border-radius: 0.5rem;
  padding: 1rem 1.5rem;
  min-inline-size: 0;
}

.assumption__frame {
  border: 0.0625rem solid rgb(var(--v-theme-app-border));
  border-radius: 0.625rem;
  overflow-x: auto;
}

.assumption__table {
  inline-size: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.assumption__table thead th {
  padding-inline: 1rem;
  padding-block: 0.625rem;
  background-color: rgb(var(--v-theme-table-header));
  color: rgb(var(--v-theme-table-header-foreground));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-align: start;
  text-transform: uppercase;
}

.assumption__table tbody th,
.assumption__table tbody td {
  padding-inline: 1rem;
  padding-block: 0.5rem;
  border-block-start: 0.0625rem solid rgb(var(--v-theme-app-border));
  background-color: rgb(var(--v-theme-table-row));
  text-align: start;
  vertical-align: middle;
}

.assumption__table tbody th {
  inline-size: 30%;
  font-weight: 500;
}

.assumption__table tbody tr:hover th,
.assumption__table tbody tr:hover td {
  background-color: rgb(var(--v-theme-table-hover));
}

.assumption__schema-link.v-btn {
  letter-spacing: normal;
  text-transform: none;
}

.assumption__attribute {
  display: block;
}

.assumption__key {
  display: block;
  font-size: 0.75rem;
  opacity: 0.6;
}

.assumption__muted {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-app-muted));
}
</style>
