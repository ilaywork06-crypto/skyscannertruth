<script setup lang="ts">
/**
 * The panel opened under a row: who proposed the assumption and who validates it - each a filter on the table -
 * and where its record stands. The values are not repeated; they are the row's own columns.
 * Mounted by AG Grid outside the page, so everything it needs comes through the grid context.
 */
import type { ICellRendererParams } from 'ag-grid-community'
import { ExternalLink, Filter, FilterX, History, CalendarClock, UserCheck } from 'lucide-vue-next'
import { Badge, Button, Table, TD, TH, TR, Tooltip, formatDateTime, translate as t, usePreferences } from '@truth-platform/ui'
import { readContext, type GridRow } from '@truth-platform/grid'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { narrowedValues } from '@/composables/registerGrid'

const props = defineProps<{ params: ICellRendererParams<GridRow> }>()
const { direction } = usePreferences()
const content = ref<HTMLElement>()

const LRI = '⁦'
const PDI = '⁩'
const PROPOSING = 'proposing_party'
const VALIDATION = 'validation_responsible_parties'

interface Party {
  name: string
  role: string
  column: string
}

const ctx = computed(() => readContext(props.params))
const parentId = computed(() => String(props.params.data?.parentId ?? ''))
const row = computed(() => ctx.value.findRow(parentId.value))
const text = (key: string) => String(row.value?.[key] ?? '').trim()
const list = (key: string) => {
  const v = row.value?.[key]
  return Array.isArray(v) ? v.map(String).filter((x) => x.length > 0) : []
}

const parties = computed<Party[]>(() => {
  const proposing = text(PROPOSING)
  return [
    ...(proposing ? [{ name: proposing, role: t('detail.proposing'), column: PROPOSING }] : []),
    ...list(VALIDATION).map((name) => ({ name, role: t('detail.validating'), column: VALIDATION })),
  ]
})

const isNarrowedTo = (p: Party) => narrowedValues(p.column).includes(p.name)
function toggleParty(p: Party) {
  const current = narrowedValues(p.column)
  ctx.value.filterBy(p.column, current.includes(p.name) ? current.filter((v) => v !== p.name) : [...current, p.name])
}

const revisionText = computed(() => {
  const reason = text('revision_reason')
  const revision = t('detail.revision', { revision: text('revision') || '0' })
  return reason ? `${revision} · ${reason}` : revision
})
const createdText = computed(() =>
  t('detail.createdBy', { moment: `${LRI}${formatDateTime(text('created_at'))}${PDI}`, creator: text('creator') }),
)
const stateLabel = computed(() => (row.value?.deleted === true ? t('detail.removed') : row.value?.archived === true ? t('detail.archived') : ''))

let observer: ResizeObserver | null = null
function report() {
  const el = content.value
  const fit = ctx.value.extra.reportDetailHeight as ((id: string, h: number) => void) | undefined
  if (el && parentId.value) fit?.(parentId.value, el.getBoundingClientRect().height)
}
onMounted(() => {
  if (!content.value || typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(report)
  observer.observe(content.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="h-full w-full overflow-auto" :dir="direction" @click.stop>
    <div ref="content" class="px-5 py-4">
      <p v-if="!row" class="text-sm text-muted-foreground">{{ t('detail.gone') }}</p>
      <template v-else>
        <div class="max-w-3xl rounded-xl border border-border bg-card shadow-soft">
          <div class="flex items-center gap-2.5 px-4 pb-2 pt-3">
            <span class="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground"><UserCheck class="size-4" /></span>
            <h4 class="text-sm font-semibold">{{ t('detail.validation') }}</h4>
            <Badge>{{ parties.length }}</Badge>
          </div>
          <Table v-if="parties.length">
            <thead>
              <tr>
                <TH>{{ t('detail.party') }}</TH>
                <TH>{{ t('detail.role') }}</TH>
                <TH class="w-12"><span class="sr-only">{{ t('detail.filter') }}</span></TH>
              </tr>
            </thead>
            <tbody>
              <TR v-for="p in parties" :key="`${p.column}:${p.name}`" :class="isNarrowedTo(p) ? 'bg-primary-soft/60' : ''">
                <TD><span class="font-medium" dir="auto">{{ p.name }}</span></TD>
                <TD><Badge :tone="p.column === PROPOSING ? 'primary' : 'neutral'">{{ p.role }}</Badge></TD>
                <TD class="w-12">
                  <Tooltip :content="isNarrowedTo(p) ? t('detail.unfilter') : t('detail.filterBy', { party: p.name })">
                    <Button
                      size="icon-xs"
                      :variant="isNarrowedTo(p) ? 'soft' : 'ghost'"
                      :aria-label="isNarrowedTo(p) ? t('detail.unfilter') : t('detail.filterBy', { party: p.name })"
                      @click.stop="toggleParty(p)"
                    >
                      <FilterX v-if="isNarrowedTo(p)" /><Filter v-else />
                    </Button>
                  </Tooltip>
                </TD>
              </TR>
            </tbody>
          </Table>
          <p v-else class="px-4 pb-4 text-sm text-muted-foreground">{{ t('detail.noValidations') }}</p>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
          <span class="inline-flex items-center gap-1.5"><History class="size-4" /><span dir="auto">{{ revisionText }}</span></span>
          <span class="inline-flex items-center gap-1.5"><CalendarClock class="size-4" /><span dir="auto">{{ createdText }}</span></span>
          <Badge v-if="stateLabel" tone="danger">{{ stateLabel }}</Badge>
          <Button class="ms-auto" size="sm" variant="soft" @click.stop="ctx.openRow(parentId)">
            <ExternalLink /> {{ t('detail.open') }}
          </Button>
        </div>
      </template>
    </div>
  </div>
</template>
