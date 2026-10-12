<template>
  <!--
    The events that are open underneath their rows. A panel pushes the rows below it down the page, so a table
    with several of them open no longer shows which rows opened them: each one is named here, is found again
    with a click, and is closed from here. Two or more of them can be laid side by side to be compared.
  -->
  <div
    v-if="chips.length > 0"
    class="expanded-rows"
  >
    <span class="expanded-rows__label">
      <v-icon
        size="16"
        icon="mdi-table-eye"
      />
      <span class="expanded-rows__count">{{ chips.length }}</span>
    </span>

    <div class="expanded-rows__chips">
      <span
        v-for="chip in chips"
        :key="chip.rowId"
        class="expanded-rows__chip"
      >
        <button
          type="button"
          class="expanded-rows__chip-main"
          :title="t('open.goTo')"
          @click="emit('reveal', chip.rowId)"
        >
          <span class="expanded-rows__chip-id">#{{ chip.number }}</span>
          <span
            class="expanded-rows__chip-brief"
            dir="auto"
          >{{ chip.brief }}</span>
        </button>
        <button
          type="button"
          class="expanded-rows__chip-close"
          :aria-label="t('open.close')"
          :title="t('open.close')"
          @click="emit('collapse', chip.rowId)"
        >
          <v-icon
            size="14"
            icon="mdi-close"
          />
        </button>
      </span>
    </div>

    <div class="expanded-rows__actions">
      <v-btn
        class="expanded-rows__action"
        variant="tonal"
        color="primary"
        size="small"
        prepend-icon="mdi-compare-horizontal"
        :disabled="chips.length < 2"
        @click="emit('compare')"
      >
        {{ t('open.compare') }}
      </v-btn>
      <v-btn
        class="expanded-rows__action"
        variant="text"
        size="small"
        prepend-icon="mdi-unfold-less-horizontal"
        @click="emit('collapse-all')"
      >
        {{ t('inventory.collapseAll') }}
      </v-btn>
    </div>
  </div>
</template>

<script lang="ts">
import type { GridRow } from '@/models/grid'

/** One open panel, named the way the table names its event. */
interface ExpandedChip {
  rowId: string
  number: string
  brief: string
}

interface Props {
  expandedIds: string[]
  rows: GridRow[]
}

interface Emits {
  (event: 'collapse', rowId: string): void
  (event: 'collapse-all'): void
  (event: 'reveal', rowId: string): void
  (event: 'compare'): void
}

export type { ExpandedChip }
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { findRowById } from '@/composables/useEventsGrid'
import { readText, useLanguage } from '@truth-platform/core-ui'

const { t } = useLanguage()

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const chips = computed<ExpandedChip[]>(() =>
  props.expandedIds.map((rowId) => {
    /*
     * A panel can outlive the block of rows that opened it - the page moved on, or the filters narrowed past
     * it - so a chip whose row is no longer loaded falls back to the identifier it was opened under.
     */
    const row = findRowById(props.rows, rowId)

    return {
      rowId,
      number: row === undefined ? rowId.slice(0, 6) : readText(row, 'event_id'),
      brief: row === undefined ? '' : readText(row, 'name'),
    }
  }),
)
</script>

<style scoped>
.expanded-rows {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-block-end: 0.5rem;
  padding-inline: 0.625rem;
  padding-block: 0.375rem;
  border: 0.0625rem solid rgb(var(--v-theme-control-border));
  border-radius: 0.75rem;
  background-color: rgb(var(--v-theme-control-surface));
}

.expanded-rows__label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  opacity: 0.85;
}

.expanded-rows__count {
  font-size: 0.8125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.expanded-rows__chips {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  min-inline-size: 0;
}

.expanded-rows__chip {
  display: inline-flex;
  align-items: center;
  max-inline-size: 18rem;
  border: 0.0625rem solid rgba(var(--v-theme-primary), 0.45);
  border-radius: 999px;
  background-color: rgba(var(--v-theme-primary), 0.1);
  overflow: hidden;
}

.expanded-rows__chip-main,
.expanded-rows__chip-close {
  display: inline-flex;
  align-items: center;
  border: none;
  background: none;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  cursor: pointer;
}

.expanded-rows__chip-main {
  gap: 0.375rem;
  min-inline-size: 0;
  padding-inline: 0.625rem 0.25rem;
  padding-block: 0.1875rem;
  font-size: 0.8125rem;
}

.expanded-rows__chip-main:hover .expanded-rows__chip-brief {
  text-decoration: underline;
}

.expanded-rows__chip-id {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.expanded-rows__chip-brief {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.85;
}

.expanded-rows__chip-close {
  justify-content: center;
  inline-size: 1.5rem;
  block-size: 1.5rem;
  opacity: 0.7;
}

.expanded-rows__chip-close:hover {
  opacity: 1;
}

.expanded-rows__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-inline-start: auto;
}

.expanded-rows__action.v-btn {
  letter-spacing: normal;
}
</style>
