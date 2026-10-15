<template>
  <div class="detail">
    <div v-if="!row.complete" class="detail__loading">
      <v-progress-circular indeterminate size="16" width="2" color="primary" />
      {{ t('detail.loading') }}
    </div>

    <div v-else class="detail__grid">
      <section class="detail__section">
        <h3 class="detail__heading">
          <v-icon icon="mdi-account-group-outline" size="16" />
          {{ t('detail.parties') }}
        </h3>
        <ul class="parties">
          <li v-for="party in parties" :key="`${party.column}:${party.name}`" class="party" :class="{ 'party--active': party.active }">
            <v-avatar size="26" class="party__avatar" :style="{ background: `rgba(var(--v-theme-${chipColor(party.name)}), 0.18)`, color: `rgb(var(--v-theme-${chipColor(party.name)}))` }">
              {{ initials(party.name) }}
            </v-avatar>
            <span class="party__name bidi">{{ party.name }}</span>
            <span class="party__role">{{ party.role }}</span>
            <v-tooltip :text="party.active ? t('detail.unfilter') : t('detail.filterBy', { party: party.name })">
              <template #activator="{ props: tip }">
                <v-btn
                  v-bind="tip"
                  :icon="party.active ? 'mdi-filter-remove-outline' : 'mdi-filter-outline'"
                  :color="party.active ? 'primary' : undefined"
                  variant="text"
                  size="x-small"
                  :aria-label="party.active ? t('detail.unfilter') : t('detail.filterBy', { party: party.name })"
                  @click.stop="toggleParty(party)"
                />
              </template>
            </v-tooltip>
          </li>
        </ul>
        <p v-if="row.validation_responsible_parties.length === 0" class="detail__muted">{{ t('detail.noValidations') }}</p>
      </section>

      <section class="detail__section">
        <h3 class="detail__heading">
          <v-icon icon="mdi-tune-variant" size="16" />
          {{ t('detail.attributes') }}
        </h3>
        <dl v-if="attributes.length > 0" class="attributes">
          <div v-for="attribute in attributes" :key="attribute.key" class="attributes__item">
            <dt class="bidi">{{ attribute.label }}</dt>
            <dd class="bidi">{{ attribute.value }}</dd>
          </div>
        </dl>
        <p v-else class="detail__muted">{{ t('detail.noAttributes') }}</p>
      </section>
    </div>

    <footer class="detail__footer">
      <span class="detail__fact"><v-icon icon="mdi-history" size="15" />{{ revisionText }}</span>
      <span class="detail__fact"><v-icon icon="mdi-calendar-clock-outline" size="15" />{{ createdText }}</span>
      <ValueChip v-if="row.deleted" :label="t('detail.removed')" color="error" />
      <ValueChip v-else-if="row.archived" :label="t('detail.archived')" color="warning" />
      <v-spacer />
      <v-btn variant="tonal" color="primary" size="small" append-icon="mdi-arrow-top-right" :to="`/assumptions/${row.id}`">
        {{ t('detail.open') }}
      </v-btn>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { isFilled } from '@/domain/json'
import type { RegisterRow } from '@/domain/register/types'
import type { SchemeField } from '@/domain/scheme'
import { fieldLabel } from '@/domain/scheme'
import { useI18n } from '@/i18n'
import ValueChip from '@/shared/components/ValueChip.vue'
import { chipColor, initials } from '@/shared/utils/colors'
import { formatDateTime, formatValue } from '@/shared/utils/format'

interface Party {
  name: string
  role: string
  column: 'proposing_party' | 'validation_responsible_parties'
  active: boolean
}

/** Keeps a left-to-right date intact inside a right-to-left sentence. */
const isolate = (text: string): string => `⁦${text}⁩`

const props = defineProps<{
  row: RegisterRow
  fields: SchemeField[]
  /** The values a column is currently narrowed to. */
  narrowedTo: (column: string) => string[]
}>()

const emit = defineEmits<{ filter: [column: string, values: string[]] }>()

const { t, language } = useI18n()

const parties = computed<Party[]>(() => {
  const proposing = props.narrowedTo('proposing_party')
  const validating = props.narrowedTo('validation_responsible_parties')

  return [
    ...(props.row.proposing_party
      ? [{ name: props.row.proposing_party, role: t('detail.proposing'), column: 'proposing_party' as const, active: proposing.includes(props.row.proposing_party) }]
      : []),
    ...props.row.validation_responsible_parties.map((name) => ({
      name,
      role: t('detail.validating'),
      column: 'validation_responsible_parties' as const,
      active: validating.includes(name),
    })),
  ]
})

const attributes = computed(() =>
  props.fields
    .filter((field) => isFilled(props.row.values[field.key]) || props.row.values[field.key] === false)
    .map((field) => ({ key: field.key, label: fieldLabel(field, language.value), value: formatValue(props.row.values[field.key]) })),
)

const toggleParty = (party: Party) => {
  const current = props.narrowedTo(party.column)
  emit('filter', party.column, party.active ? current.filter((name) => name !== party.name) : [...current, party.name])
}

const revisionText = computed(() => {
  const revision = t('detail.revision', { revision: props.row.revision })

  return props.row.revision_reason ? `${revision} · ${props.row.revision_reason}` : revision
})

const createdText = computed(() =>
  t('detail.createdBy', { moment: isolate(formatDateTime(props.row.created_at)), creator: props.row.creator }),
)
</script>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.1rem 1.25rem 1rem;
  background: rgb(var(--v-theme-surface-bright));
  border-block: 1px solid rgb(var(--v-theme-border));
  box-shadow: inset 3px 0 0 rgb(var(--v-theme-primary));
}

[dir='rtl'] .detail {
  box-shadow: inset -3px 0 0 rgb(var(--v-theme-primary));
}

.detail__loading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.875rem;
  color: rgb(var(--v-theme-muted));
}

.detail__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 1.5rem;
}

@media (max-width: 900px) {
  .detail__grid {
    grid-template-columns: 1fr;
  }
}

.detail__section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-inline-size: 0;
}

.detail__heading {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-muted));
}

.detail__muted {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}

.parties {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  list-style: none;
}

.party {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.3rem 0.4rem;
  border-radius: 10px;
  font-size: 0.875rem;
}

.party--active {
  background: rgba(var(--v-theme-primary), 0.1);
}

.party__avatar {
  font-size: 0.65rem;
  font-weight: 700;
}

.party__name {
  flex: 1;
  min-inline-size: 0;
  font-weight: 500;
}

.party__role {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-muted));
}

.attributes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.5rem;
}

.attributes__item {
  padding: 0.5rem 0.7rem;
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-border));
}

.attributes__item dt {
  font-size: 0.72rem;
  color: rgb(var(--v-theme-muted));
}

.attributes__item dd {
  font-size: 0.875rem;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.detail__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.25rem;
  padding-top: 0.75rem;
  border-top: 1px dashed rgb(var(--v-theme-border));
}

.detail__fact {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}
</style>
