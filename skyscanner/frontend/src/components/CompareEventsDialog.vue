<template>
  <!--
    The open or ticked events side by side: one column per event, one line per field, and every line whose
    values are not all the same marked. The fields are the table's own columns, the hidden ones included,
    rendered the way the table renders them - so what is compared is exactly what is stored.
  -->
  <v-dialog
    :model-value="modelValue"
    max-width="90rem"
    scrollable
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-card class="compare">
      <div class="compare__head">
        <SectionHeader
          :title="t('compare.title')"
          :count="rows.length"
        >
          <v-switch
            v-model="onlyDifferences"
            class="compare__switch"
            color="primary"
            density="compact"
            hide-details
            :label="t('compare.onlyDifferences')"
          />
          <v-btn
            icon="mdi-close"
            variant="text"
            size="small"
            :aria-label="t('common.close')"
            @click="emit('update:modelValue', false)"
          />
        </SectionHeader>
      </div>

      <v-card-text class="compare__body">
        <div
          class="compare__frame"
          :dir="direction"
        >
          <table class="compare__table">
            <thead>
              <tr>
                <th class="compare__corner" />
                <th
                  v-for="row in rows"
                  :key="String(row.id)"
                  class="compare__event"
                >
                  <span class="compare__event-id">#{{ readText(row, 'event_id') }}</span>
                  <span
                    class="compare__event-brief"
                    dir="auto"
                  >{{ readText(row, 'name') }}</span>
                  <v-btn
                    class="compare__remove"
                    icon="mdi-close"
                    variant="text"
                    size="x-small"
                    :aria-label="t('compare.remove')"
                    @click="emit('remove', String(row.id))"
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="line in shownLines"
                :key="line.column.colId"
                :class="{ 'compare__line--differs': line.differs }"
              >
                <th
                  class="compare__field"
                  scope="row"
                >
                  <span dir="auto">{{ line.column.headerName }}</span>
                </th>
                <td
                  v-for="row in rows"
                  :key="String(row.id)"
                  class="compare__value"
                >
                  <DynamicCell
                    :column="line.column"
                    :row="row"
                    :taxonomy="taxonomy"
                    :token-for="paletteToken"
                    @open="emit('open', $event)"
                    @download="emit('download', $event)"
                  />
                </td>
              </tr>
              <tr v-if="shownLines.length === 0">
                <td
                  class="compare__same"
                  :colspan="rows.length + 1"
                >
                  {{ t('compare.allSame') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import type { Artifact } from '@/models/common'
import type { GeneratedColumn, GridRow, TaxonomyItem } from '@truth-platform/core-ui'

interface Props {
  modelValue: boolean
  /** The events being compared, in the order they were opened or ticked. */
  rows: GridRow[]
  /** Every column of the inventory, the hidden ones included. */
  columns: GeneratedColumn[]
  taxonomy: TaxonomyItem[]
}

interface Emits {
  (event: 'update:modelValue', open: boolean): void
  (event: 'remove', rowId: string): void
  (event: 'open', artifact: Artifact): void
  (event: 'download', artifact: Artifact): void
}

/** One field of the comparison and whether the events disagree about it. */
interface CompareLine {
  column: GeneratedColumn
  differs: boolean
}

/** The columns that are furniture of the table rather than values of an event. */
const FURNITURE: string[] = ['open', 'expander', 'actions']

/**
 * The moment an event was created, drawn the way the table draws a bookkeeping stamp. The table shows no such
 * column, so the comparison carries its own.
 */
const createdAtColumn = (headerName: string): GeneratedColumn => ({
  colId: 'created_at',
  field: 'created_at',
  headerName,
  headerNameHebrew: '',
  sortable: false,
  filter: false,
  floatingFilter: false,
  resizable: false,
  hide: false,
  editable: false,
  flex: null,
  minWidth: null,
  maxWidth: null,
  width: null,
  pinned: null,
  cellRenderer: 'DateCellRenderer',
  cellRendererParams: { withTime: true, stamp: true },
  cellDataType: false,
  headerClass: null,
  cellClass: null,
  autoHeight: false,
  fieldType: 'datetime',
  dynamic: false,
  discovered: false,
  industry: null,
  filterOptions: [],
  quickFilter: false,
})
</script>

<script setup lang="ts">
import { DynamicCell, SectionHeader, readPath, readText, useLanguage } from '@truth-platform/core-ui'
import { computed, ref } from 'vue'

import { paletteToken } from '@/utils/colors'

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t, direction } = useLanguage()

const onlyDifferences = ref<boolean>(false)

/*
 * What the comparison is made of: the table's columns, and the moment the event was created, which the table
 * no longer shows but which tells two otherwise identical events apart.
 */
const compared = computed<GeneratedColumn[]>(() => {
  const own = props.columns.filter((column) => column.headerName.length > 0 && !FURNITURE.includes(column.colId))

  if (own.some((column) => column.colId === 'created_at')) {
    return own
  }

  return [...own, createdAtColumn(t('event.createdAt'))]
})

/**
 * Read a value in a form two events can be compared by, whatever shape it is stored in.
 */
const fingerprint = (row: GridRow, column: GeneratedColumn): string => {
  const value = readPath(row, column.field)
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
    return ''
  }

  return JSON.stringify(value)
}

const lines = computed<CompareLine[]>(() =>
  compared.value.map((column) => {
    const seen = new Set(props.rows.map((row) => fingerprint(row, column)))

    return { column, differs: seen.size > 1 }
  }),
)

const shownLines = computed<CompareLine[]>(() =>
  onlyDifferences.value ? lines.value.filter((line) => line.differs) : lines.value,
)
</script>

<style scoped>
.compare {
  background-color: rgb(var(--v-theme-surface));
}

.compare__head {
  padding-inline: 1.25rem 0.75rem;
  padding-block: 0.75rem;
  border-block-end: 0.0625rem solid rgb(var(--v-theme-app-border));
}

.compare__switch {
  flex: 0 0 auto;
  margin-inline-end: 0.5rem;
}

.compare__body {
  padding: 0;
}

.compare__frame {
  overflow: auto;
  max-block-size: 72vh;
}

.compare__table {
  border-collapse: separate;
  border-spacing: 0;
  min-inline-size: 100%;
  font-size: 0.875rem;
}

.compare__table th,
.compare__table td {
  padding-inline: 0.75rem;
  padding-block: 0.5rem;
  border-block-end: 0.0625rem solid rgb(var(--v-theme-app-border));
  text-align: start;
  vertical-align: middle;
}

/* The heads of the events and the names of the fields stay in sight while the comparison scrolls. */
.compare__table thead th {
  position: sticky;
  inset-block-start: 0;
  z-index: 2;
  background-color: rgb(var(--v-theme-table-header));
  color: rgb(var(--v-theme-table-header-foreground));
}

.compare__field,
.compare__corner {
  position: sticky;
  inset-inline-start: 0;
  z-index: 1;
  min-inline-size: 11rem;
  background-color: rgb(var(--v-theme-table-header));
  color: rgb(var(--v-theme-table-header-foreground));
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  white-space: nowrap;
}

.compare__corner {
  z-index: 3;
}

.compare__event {
  min-inline-size: 14rem;
  max-inline-size: 22rem;
}

.compare__event-id {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  opacity: 0.8;
  font-variant-numeric: tabular-nums;
}

.compare__event-brief {
  display: inline-block;
  max-inline-size: calc(100% - 2rem);
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.compare__remove {
  vertical-align: middle;
}

.compare__value {
  background-color: rgb(var(--v-theme-table-row));
  max-inline-size: 22rem;
}

/* A field the events disagree about is the one worth reading, so it is marked across its whole line. */
.compare__line--differs .compare__value {
  background-color: rgba(var(--v-theme-primary), 0.1);
}

.compare__line--differs .compare__field {
  border-inline-start: 0.1875rem solid rgb(var(--v-theme-primary));
}

.compare__same {
  padding-block: 2rem;
  text-align: center;
  opacity: 0.7;
}
</style>
