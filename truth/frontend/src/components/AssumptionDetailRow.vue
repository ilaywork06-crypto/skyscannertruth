<template>
  <div class="detail-row">
    <div
      ref="content"
      class="detail-row__content"
    >
      <div
        v-if="row === undefined"
        class="detail-row__muted"
      >
        {{ t('detail.gone') }}
      </div>

      <template v-else>
        <!--
          The values of an assumption are already in the columns of its row - every assumption of an industry is
          filled against the same schemas - so the panel is left to what a row cannot show: who proposed the
          assumption, who validates it, and where its record stands.
        -->
        <section class="detail-row__section">
          <SectionHeader
            icon="mdi-account-check-outline"
            :title="t('detail.validation')"
            :count="parties.length"
          />

          <div
            v-if="parties.length > 0"
            class="detail-row__frame"
            :dir="direction"
          >
            <table class="detail-row__table">
              <thead>
                <tr>
                  <th>{{ t('detail.party') }}</th>
                  <th>{{ t('detail.role') }}</th>
                  <th class="detail-row__narrow">
                    <span class="detail-row__sr">{{ t('detail.filter') }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="party in parties"
                  :key="`${party.column}:${party.name}`"
                  :class="{ 'detail-row__line--active': isNarrowedTo(party) }"
                >
                  <td>
                    <span
                      class="detail-row__party"
                      dir="auto"
                    >{{ party.name }}</span>
                  </td>
                  <td>
                    <UiChip
                      :label="party.role"
                      token="chip-neutral"
                    />
                  </td>
                  <td class="detail-row__narrow">
                    <v-btn
                      :icon="isNarrowedTo(party) ? 'mdi-filter-remove-outline' : 'mdi-filter-outline'"
                      :color="isNarrowedTo(party) ? 'primary' : undefined"
                      variant="text"
                      size="small"
                      density="comfortable"
                      :title="isNarrowedTo(party) ? t('detail.unfilter') : t('detail.filterBy', { party: party.name })"
                      :aria-label="isNarrowedTo(party) ? t('detail.unfilter') : t('detail.filterBy', { party: party.name })"
                      @click.stop="toggleParty(party)"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p
            v-else
            class="detail-row__muted"
          >
            {{ t('detail.noValidations') }}
          </p>
        </section>

        <footer class="detail-row__footer">
          <span class="detail-row__fact">
            <v-icon
              size="16"
              icon="mdi-history"
            />
            <span dir="auto">{{ revisionText }}</span>
          </span>
          <span class="detail-row__fact">
            <v-icon
              size="16"
              icon="mdi-calendar-clock-outline"
            />
            <span dir="auto">{{ createdText }}</span>
          </span>
          <UiChip
            v-if="stateLabel.length > 0"
            :label="stateLabel"
            token="status-negative"
          />

          <span class="detail-row__spacer" />

          <v-btn
            variant="tonal"
            color="primary"
            size="small"
            prepend-icon="mdi-open-in-new"
            @click="open"
          >
            {{ t('detail.open') }}
          </v-btn>
        </footer>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import type { GridRow } from '@truth-platform/core-ui'
import type { ICellRendererParams } from 'ag-grid-community'

import type { AssumptionGridContext } from '@/components/AssumptionsGrid.vue'

interface Props {
  params: ICellRendererParams<GridRow>
}

/** One party the assumption involves, and the column of the table it is filtered through. */
interface Party {
  name: string
  role: string
  column: string
}

/** The marks that open and close a run laid out left to right whatever surrounds it. */
const LEFT_TO_RIGHT_ISOLATE = '\u2066'
const POP_ISOLATE = '\u2069'

/** The columns the parties are narrowed through, which are the ones the table shows them in. */
const PROPOSING_COLUMN = 'proposing_party'
const VALIDATION_COLUMN = 'validation_responsible_parties'
</script>

<script setup lang="ts">
import { SectionHeader, UiChip, formatDateTime, readContext, useLanguage } from '@truth-platform/core-ui'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { narrowedValues } from '@/composables/useAssumptionsGrid'

const props = defineProps<Props>()

const { t, direction } = useLanguage()

const content = ref<HTMLElement | null>(null)

const context = computed<AssumptionGridContext>(() => readContext(props.params) as AssumptionGridContext)
const parentId = computed<string>(() => String(props.params.data?.parentId ?? ''))
const row = computed<GridRow | undefined>(() => context.value.findRow(parentId.value))

const readText = (key: string): string => String(row.value?.[key] ?? '').trim()

const readList = (key: string): string[] => {
  const value = row.value?.[key]

  return Array.isArray(value) ? value.map((item) => String(item)).filter((item) => item.length > 0) : []
}

/* The party that proposed the assumption comes first, then every party it is validated by. */
const parties = computed<Party[]>(() => {
  const proposing = readText(PROPOSING_COLUMN)

  return [
    ...(proposing.length > 0 ? [{ name: proposing, role: t('detail.proposing'), column: PROPOSING_COLUMN }] : []),
    ...readList(VALIDATION_COLUMN).map((name) => ({ name, role: t('detail.validating'), column: VALIDATION_COLUMN })),
  ]
})

/*
 * Whether the table is narrowed to a party is read off the conditions the table is actually running, so a
 * line marked here and the chip above the table can never disagree.
 */
const isNarrowedTo = (party: Party): boolean => narrowedValues(party.column).includes(party.name)

/**
 * Narrow the register to one party, or lift that narrowing when it is already in force.
 *
 * Picking a second party of the same column widens the narrowing to both, which is what ticking two values in
 * the column's own filter does.
 */
const toggleParty = (party: Party) => {
  const current = narrowedValues(party.column)
  const next = current.includes(party.name)
    ? current.filter((candidate) => candidate !== party.name)
    : [...current, party.name]

  context.value.filterBy(party.column, next)
}

const revisionText = computed<string>(() => {
  const reason = readText('revision_reason')
  const revision = t('detail.revision', { revision: readText('revision') || '0' })

  return reason.length > 0 ? `${revision} · ${reason}` : revision
})

/*
 * The moment is isolated as a left to right run: it is written in digits, and inside a Hebrew sentence the
 * parts of "16/09/2026, 12:18" would otherwise be laid out back to front.
 */
const createdText = computed<string>(() =>
  t('detail.createdBy', {
    moment: `${LEFT_TO_RIGHT_ISOLATE}${formatDateTime(readText('created_at'))}${POP_ISOLATE}`,
    creator: readText('creator'),
  }),
)

/* An assumption in force says nothing about it; only one that was archived or removed is marked. */
const stateLabel = computed<string>(() => {
  if (row.value?.deleted === true) {
    return t('detail.removed')
  }

  return row.value?.archived === true ? t('detail.archived') : ''
})

const open = () => context.value.openRow(parentId.value)

/*
 * The row above was given a height before this panel was drawn, so the panel measures itself and says so.
 *
 * What is measured is the inner box rather than the outer one: the outer is pinned to whatever height the
 * row currently has, so it never changes size and would report the same wrong height forever.
 */
let observer: ResizeObserver | null = null

const report = () => {
  const element = content.value
  if (element === null || parentId.value.length === 0) {
    return
  }

  context.value.reportDetailHeight(parentId.value, element.getBoundingClientRect().height)
}

onMounted(() => {
  const element = content.value
  if (element === null || typeof ResizeObserver === 'undefined') {
    return
  }

  observer = new ResizeObserver(report)
  observer.observe(element)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<!--
  The styles are deliberately not scoped. AG Grid mounts a cell renderer outside the render tree of the page,
  so the component never receives the attribute a scoped block keys its selectors on and not one of them would
  match. Every class below is prefixed for that reason.
-->
<style>
.detail-row {
  inline-size: 100%;
  block-size: 100%;
  /* A panel taller than the ceiling a single row may take scrolls inside itself rather than being cut off. */
  overflow: auto;
  background-color: rgb(var(--v-theme-table-row-alt));
  border-block-end: 0.0625rem solid rgb(var(--v-theme-app-border));
  cursor: default;
}

.detail-row__content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  inline-size: 100%;
  padding-inline: 1.5rem;
  padding-block: 0.875rem 1rem;
}

.detail-row__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-inline-size: 0;
}

.detail-row__muted {
  color: rgb(var(--v-theme-app-muted));
  font-size: 0.875rem;
}

/* The table of the parties is drawn like every other table inside a panel: a framed box with a header band. */
.detail-row__frame {
  max-inline-size: 48rem;
  border: 0.0625rem solid rgb(var(--v-theme-app-border));
  border-radius: 0.625rem;
  overflow: hidden;
}

.detail-row__table {
  inline-size: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.detail-row__table th {
  padding-inline: 0.875rem;
  padding-block: 0.5rem;
  background-color: rgb(var(--v-theme-table-header));
  color: rgb(var(--v-theme-table-header-foreground));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-align: start;
  text-transform: uppercase;
}

.detail-row__table td {
  padding-inline: 0.875rem;
  padding-block: 0.25rem;
  border-block-start: 0.0625rem solid rgb(var(--v-theme-app-border));
  background-color: rgb(var(--v-theme-table-row));
  vertical-align: middle;
  block-size: 2.5rem;
}

.detail-row__table tr:hover td {
  background-color: rgb(var(--v-theme-table-hover));
}

/* A party the table is narrowed to is marked across its whole line, so a second press reads as lifting it. */
.detail-row__line--active td {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.detail-row__table .detail-row__narrow {
  inline-size: 3rem;
  padding-inline: 0.25rem;
  text-align: center;
}

.detail-row__party {
  font-weight: 500;
  overflow-wrap: anywhere;
}

.detail-row__sr {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.detail-row__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.25rem;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-app-muted));
}

.detail-row__fact {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.detail-row__spacer {
  flex: 1 1 auto;
}
</style>
