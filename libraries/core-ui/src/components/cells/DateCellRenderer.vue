<template>
  <!--
    A moment the system recorded rather than one anybody chose - created at, updated at - stands at the end of
    its column behind the mark of a date, quieter and shorter than the values beside it. It is worth having
    and rarely what a reader opened the table for, and it used to take the two widest columns in the row.
  -->
  <span
    v-if="isStamp"
    class="date-cell date-cell--stamp"
  >
    {{ display }}
  </span>
  <span
    v-else
    class="date-cell"
  >{{ display }}</span>
</template>

<script lang="ts">
import type { ICellRendererParams } from 'ag-grid-community'
import { formatCompactDateTime, formatDate, formatDateTime } from '../../index'
import type { GridRow } from '../../models/grid'

interface Props {
  params: ICellRendererParams<GridRow> & { withTime?: boolean, stamp?: boolean }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'


const props = defineProps<Props>()

/* The moments the cell holds: one, or the several a field declared as a list of dates carries. */
const moments = computed<string[]>(() => {
  const value: unknown = props.params.value
  const listed = Array.isArray(value) ? value : [value]

  return listed.filter((item): item is string => typeof item === 'string' && item.length > 0)
})

/* Whether this column carries a moment the system recorded rather than one the user picked. */
const isStamp = computed<boolean>(() => props.params.stamp === true)

/*
 * A date the user chose is a day, but a moment the system recorded is a point in time - knowing that two
 * events were uploaded on the same day is rarely enough, so those columns ask for the clock as well. A stamp
 * asks for it in the shortest form that still reads, because taking as little of the row as possible is the
 * whole point of it.
 */
const formatOne = (moment: string | null): string => {
  if (props.params.withTime !== true) {
    return formatDate(moment)
  }

  return isStamp.value ? formatCompactDateTime(moment) : formatDateTime(moment)
}

const display = computed<string>(() =>
  moments.value.length === 0 ? formatOne(null) : moments.value.map(formatOne).join(', '),
)
</script>

<style>
.date-cell {
  display: block;
  white-space: nowrap;
}

/*
 * The stamp sits at the end of its column in digits of one width, so that a column of them lines up and can
 * be compared down the page rather than read one row at a time.
 */
.date-cell--stamp {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.65;
}
</style>
