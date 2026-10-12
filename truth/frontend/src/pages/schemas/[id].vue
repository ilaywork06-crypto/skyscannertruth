<template>
  <div class="sky-page">
    <AppHeader :industries="industries" />

    <div class="sky-page__content schema">
      <div class="schema__heading">
        <span class="schema__badge">{{ t('schemas.badge') }}</span>
        <div class="schema__heading-row">
          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            :aria-label="t('schemas.back')"
            :title="t('schemas.back')"
            to="/schemas"
          />
          <h1
            class="schema__title"
            dir="auto"
          >
            {{ detail?.name ?? t('schemas.badge') }}
          </h1>
          <v-spacer />
          <v-btn
            v-if="detail !== null"
            color="primary"
            prepend-icon="mdi-pencil"
            @click="reviseOpen = true"
          >
            {{ t('schemas.revise') }}
          </v-btn>
        </div>
        <p
          v-if="detail !== null && detail.description.length > 0"
          class="schema__description"
          dir="auto"
        >
          <UiLinkedText :text="detail.description" />
        </p>
      </div>

      <div
        v-if="loading"
        class="schema__loading"
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
        <section class="schema__facts">
          <div class="schema__fact">
            <span class="schema__fact-label">{{ t('column.industry') }}</span>
            <span class="schema__fact-chips">
              <template v-if="detail.global !== true">
                <UiChip
                  v-for="industry in detail.industries ?? []"
                  :key="industry.id"
                  :label="industry.name"
                  :token="hashedToken(industry.name)"
                />
              </template>
              <span
                v-if="detail.global === true || (detail.industries ?? []).length === 0"
                class="schema__fact-value"
              >{{ detail.global === true ? t('schemas.globalShort') : t('schemas.allIndustries') }}</span>
            </span>
          </div>
          <div class="schema__fact">
            <span class="schema__fact-label">{{ t('column.revision') }}</span>
            <span
              class="schema__fact-value"
              dir="auto"
            >
              {{ detail.revision }}<template v-if="detail.revision_reason.length > 0"> · <UiLinkedText :text="detail.revision_reason" /></template>
            </span>
          </div>
          <div
            v-if="stateLabel.length > 0"
            class="schema__fact"
          >
            <span class="schema__fact-label">{{ t('detail.state') }}</span>
            <UiChip
              :label="stateLabel"
              token="status-negative"
            />
          </div>
          <div class="schema__fact schema__fact--stamp">
            <span class="schema__fact-label">{{ t('column.createdAt') }}</span>
            <span class="schema__fact-value">
              <span dir="ltr">{{ formatDateTime(detail.created_at) }}</span>
              <span class="schema__muted">· {{ detail.creator }}</span>
            </span>
          </div>
        </section>

        <section class="schema__panel">
          <SectionHeader
            icon="mdi-table-cog"
            :title="t('schemas.attributes')"
            :count="scheme.fields.length"
          />

          <div
            v-if="scheme.fields.length > 0"
            class="schema__frame"
            :dir="direction"
          >
            <table class="schema__table">
              <thead>
                <tr>
                  <th>{{ t('schemas.key') }}</th>
                  <th
                    v-for="side in nameSides"
                    :key="side"
                  >
                    {{ t(`names.${side}`) }}
                  </th>
                  <th>{{ t('schemas.type') }}</th>
                  <th class="schema__center">
                    {{ t('schemas.required') }}
                  </th>
                  <th class="schema__center">
                    {{ t('schemas.many') }}
                  </th>
                  <th>{{ t('schemas.allowed') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="field in scheme.fields"
                  :key="field.key"
                >
                  <td>
                    <code
                      class="schema__key ui-name"
                      dir="ltr"
                    >{{ field.key }}</code>
                  </td>
                  <td
                    v-for="side in nameSides"
                    :key="side"
                  >
                    <span
                      class="ui-name"
                      :dir="NAME_DIRECTIONS[side]"
                    >{{ fieldNames(field)[side] || EMPTY_PLACEHOLDER }}</span>
                  </td>
                  <td>
                    <UiChip
                      :label="typeLabel(field.type)"
                      token="chip-neutral"
                    />
                  </td>
                  <td class="schema__center">
                    <v-icon
                      v-if="field.required"
                      size="18"
                      icon="mdi-check"
                      :aria-label="t('common.yes')"
                    />
                    <span v-else>{{ EMPTY_PLACEHOLDER }}</span>
                  </td>
                  <td class="schema__center">
                    <v-icon
                      v-if="field.array"
                      size="18"
                      icon="mdi-check"
                      :aria-label="t('common.yes')"
                    />
                    <span v-else>{{ EMPTY_PLACEHOLDER }}</span>
                  </td>
                  <td>
                    <span
                      v-if="hasOptions(field.type)"
                      class="schema__chips"
                    >
                      <UiChip
                        v-for="option in field.options"
                        :key="option"
                        :label="option"
                        token="chip-neutral"
                      />
                    </span>
                    <span
                      v-else
                      dir="ltr"
                    >{{ boundsOf(field) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-else
            class="schema__muted"
          >
            {{ t('schemas.noAttributes') }}
          </p>
        </section>
      </template>
    </div>

    <CreateSchemaDialog
      v-model="reviseOpen"
      :revised-schema="detail"
      @created="onRevised"
    />
  </div>
</template>

<script setup lang="ts">
import {
  EMPTY_PLACEHOLDER,
  NAME_DIRECTIONS,
  SectionHeader,
  UiChip,
  formatDateTime,
  hashedToken,
  nameColumnOrder,
  useLanguage,
  type NameSide,
  UiLinkedText,
} from '@truth-platform/core-ui'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import CreateSchemaDialog from '@/components/CreateSchemaDialog.vue'
import { useRegister } from '@/composables/useRegister'
import type { SchemaDetail } from '@/models/schema'
import type { Scheme, SchemeField } from '@/models/scheme'
import { readLatestSchema } from '@/requests/schemas'
import { fieldNames, hasOptions, isNumeric, readScheme, typeLabel } from '@/utils/scheme'

const { t, direction } = useLanguage()

const nameSides = computed<NameSide[]>(() => nameColumnOrder())

const route = useRoute('/schemas/[id]')
const { industries, load } = useRegister()

const detail = ref<SchemaDetail | null>(null)
const loading = ref<boolean>(true)
const errorMessage = ref<string>('')
const reviseOpen = ref<boolean>(false)

const schemaId = computed<string>(() => route.params.id)
const scheme = computed<Scheme>(() => readScheme(detail.value?.scheme))

/**
 * Read the schema this page is showing, whenever the address changes to a different one.
 */
const loadSchema = async (): Promise<void> => {
  loading.value = true
  errorMessage.value = ''
  try {
    detail.value = await readLatestSchema(schemaId.value)
  } catch (error) {
    detail.value = null
    errorMessage.value = error instanceof Error ? error.message : t('schemas.unreadable')
  } finally {
    loading.value = false
  }
}

watch(schemaId, () => void loadSchema(), { immediate: true })

/* A schema in force says nothing about it; only one that was archived or removed is marked. */
const stateLabel = computed<string>(() => {
  if (detail.value?.deleted === true) {
    return t('detail.removed')
  }

  return detail.value?.archived === true ? t('detail.archived') : ''
})

/**
 * Say what a number may hold - its bounds and its increment - or nothing for any other kind.
 */
const boundsOf = (field: SchemeField): string => {
  if (!isNumeric(field.type)) {
    return EMPTY_PLACEHOLDER
  }

  const said: string[] = []
  if (field.min !== null) {
    said.push(`≥ ${field.min}`)
  }
  if (field.max !== null) {
    said.push(`≤ ${field.max}`)
  }
  if (field.step !== null) {
    said.push(`± ${field.step}`)
  }

  return said.join('  ') || EMPTY_PLACEHOLDER
}

/**
 * Read the schema again after it was revised, and refresh the register so its columns follow the change.
 */
const onRevised = async () => {
  await loadSchema()
  await load(true)
}
</script>

<style scoped>
.schema {
  gap: 1.25rem;
}

.schema__heading {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-block-start: 0.5rem;
}

.schema__badge {
  align-self: flex-start;
  margin-inline-start: 2.5rem;
  background-color: rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 0.375rem;
  padding-inline: 0.625rem;
  padding-block: 0.125rem;
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.schema__heading-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.schema__title {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.2;
}

.schema__description {
  margin-inline-start: 3.25rem;
  opacity: 0.8;
  line-height: 1.5;
}

.schema__loading {
  display: flex;
  justify-content: center;
  padding-block: 3rem;
}

.schema__facts {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem 2rem;
  background-color: rgb(var(--v-theme-surface));
  border-radius: 0.5rem;
  padding: 1rem 1.5rem;
}

.schema__fact {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-inline-size: 0;
}

.schema__fact-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.7;
}

.schema__fact-value {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-block-size: 1.5rem;
  font-size: 0.9375rem;
}

.schema__fact-chips,
.schema__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.schema__fact--stamp {
  margin-inline-start: auto;
  opacity: 0.85;
}

.schema__panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background-color: rgb(var(--v-theme-surface));
  border-radius: 0.5rem;
  padding: 1rem 1.5rem;
  min-inline-size: 0;
}

/* A wide table of attributes scrolls inside its own frame rather than widening the page. */
.schema__frame {
  border: 0.0625rem solid rgb(var(--v-theme-app-border));
  border-radius: 0.625rem;
  overflow-x: auto;
}

.schema__table {
  inline-size: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.schema__table th {
  padding-inline: 1rem;
  padding-block: 0.625rem;
  background-color: rgb(var(--v-theme-table-header));
  color: rgb(var(--v-theme-table-header-foreground));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-align: start;
  text-transform: uppercase;
  white-space: nowrap;
}

.schema__table td {
  padding-inline: 1rem;
  padding-block: 0.5rem;
  border-block-start: 0.0625rem solid rgb(var(--v-theme-app-border));
  background-color: rgb(var(--v-theme-table-row));
  text-align: start;
  vertical-align: middle;
}

.schema__table tbody tr:hover td {
  background-color: rgb(var(--v-theme-table-hover));
}

.schema__table .schema__center {
  text-align: center;
}

.schema__key {
  font-size: 0.8125rem;
}

.schema__muted {
  font-size: 0.875rem;
  color: rgb(var(--v-theme-app-muted));
}
</style>
