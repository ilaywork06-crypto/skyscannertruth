<script setup lang="ts">
/**
 * One industry's register: search, column picker, import/export, the create form, the reading progress, quick
 * filters, the active-filter chips, the table and its pager. Everything is answered out of the rows already read.
 */
import { Columns3, Download, FileJson, FileSpreadsheet, Inbox, Plus, Search, SearchX, Upload, X } from 'lucide-vue-next'
import {
  Button, Card, EmptyState, Input, Menu, MenuCheckItem, MenuItem, MenuLabel, Progress, Skeleton, downloadBlob, notify,
  reportError, translate as t,
} from '@truth-platform/ui'
import {
  ActiveFilters, Pagination, QuickFilters, baseFilters, baseRenderers, type FilterChip, type GridContext, type GridRow,
  type QuickFilterChoice, type TaxonomyItem,
} from '@truth-platform/grid'
import type { FilterModel, SortModelItem } from 'ag-grid-community'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { readLatestAssumption } from '@/api/endpoints'
import { useRegister } from '@/composables/register'
import { useRegisterGrid } from '@/composables/registerGrid'
import { buildBundle, bundleFileName, writeBundle } from '@/lib/bundle'
import { readCreator } from '@/lib/misc'
import { exportRows } from '@/lib/sheet'
import AssumptionDetailRow from './AssumptionDetailRow.vue'
import CreateAssumptionDialog from './CreateAssumptionDialog.vue'
import ImportBundleDialog from './ImportBundleDialog.vue'
import RegisterSetFilter from './RegisterSetFilter.vue'
import RegisterTable from './RegisterTable.vue'

const props = defineProps<{ industry: string }>()
const router = useRouter()
const register = useRegister()
const industry = computed(() => props.industry)
const fields = computed(() => register.fieldsForIndustries([props.industry]))
const { controller, columns } = useRegisterGrid({ assumptions: register.assumptions, fields, industry })

const registry = baseRenderers()
const filters = baseFilters({ SetColumnFilter: RegisterSetFilter })
const table = ref<InstanceType<typeof RegisterTable> | null>(null)
const createOpen = ref(false)
const importOpen = ref(false)
const exporting = ref(false)
/** The schemas column starts hidden; the choice lives with the page, not in storage. */
const hidden = ref<string[]>(['schemas'])
const visibleColumns = computed(() => columns.value.filter((c) => !hidden.value.includes(c.colId)).map((c) => c.colId))
const pickable = computed(() => columns.value.filter((c) => c.headerName && c.colId !== 'expand'))

const detailHeights = ref<Record<string, number>>({})
const DEFAULT_DETAIL_HEIGHT = 220
const detailRowHeight = (id: string) => detailHeights.value[id] ?? DEFAULT_DETAIL_HEIGHT
function reportDetailHeight(id: string, height: number) {
  const h = Math.ceil(height)
  if (Math.abs(detailRowHeight(id) - h) < 2) return
  detailHeights.value = { ...detailHeights.value, [id]: h }
  table.value?.fitDetail(id, h)
}

const taxonomy = computed<TaxonomyItem[]>(() => register.industries.value.map((i) => ({ key: i.name, name: i.name })))
const context = computed<GridContext>(() => ({
  search: controller.search.value,
  taxonomy: taxonomy.value,
  expandedIds: controller.expandedIds.value,
  toggleExpanded: controller.toggleExpanded,
  openRow: (id) => void router.push(`/assumptions/${id}`),
  filterBy: (colId, values) => table.value?.setColumnFilterValues(colId, values),
  openArtifact: () => {},
  downloadArtifact: () => {},
  findRow: (id) => controller.rows.value.find((r) => String(r.id) === id),
  rowLink: (id) => `/assumptions/${id}`,
  extra: { reportDetailHeight },
}))

const progress = computed(() => register.progress.value)
const emptyMessage = computed(() => (register.assumptions.value.length === 0 ? t('register.empty') : t('register.emptyNarrowed')))
const searchText = computed({
  get: () => controller.search.value,
  set: (v: string | number | null | undefined) => controller.setSearch(String(v ?? '')),
})

function toggleColumn(colId: string, visible: boolean) {
  hidden.value = visible ? hidden.value.filter((c) => c !== colId) : [...hidden.value, colId]
  table.value?.setColumnVisible(colId, visible)
}
const onModels = (sort: SortModelItem[], model: FilterModel) => controller.applyGridModels(sort, model)
const onQuick = (choice: QuickFilterChoice) => table.value?.setColumnFilterValues(choice.colId, choice.values)
function onRemoveChip(chip: FilterChip) {
  if (chip.kind === 'column') table.value?.clearColumnFilter(chip.colId)
  else if (chip.kind === 'search') controller.setSearch('')
}
function clearAll() {
  controller.search.value = ''
  table.value?.clearFilters()
  void controller.refreshRows()
}

async function onCreated(id: string) {
  try {
    const detail = await register.refreshAssumption(id)
    register.assumptions.value = [{ ...detail, detail }, ...register.assumptions.value.filter((r) => r.id !== id)]
    await controller.refreshRows()
  } catch (e) {
    reportError(e)
  }
}
async function onRestored() {
  await controller.refreshConfiguration()
  await controller.refreshRows()
}

function exportSheet() {
  try {
    // The page on screen (after search, filters and sort), in the visible columns and the page's language.
    exportRows(controller.rows.value, columns.value.filter((c) => visibleColumns.value.includes(c.colId)))
    notify(t('register.exported'))
  } catch (e) {
    reportError(e)
  }
}

async function exportBundle() {
  exporting.value = true
  try {
    const matches = (inds: { id: string; name: string }[]) => inds.some((i) => i.id === props.industry || i.name === props.industry)
    const rows = register.assumptions.value.filter((r) => r.detail === null || matches(r.detail.industries))
    const details = await Promise.all(rows.map(async (r) => r.detail ?? (await readLatestAssumption(r.id))))
    const scoped = details.filter((d) => matches(d.industries))
    const named = new Set(scoped.flatMap((d) => d.schemas.map((s) => s.name)))
    const name = register.findIndustry(props.industry)?.name ?? null
    const bundle = buildBundle({
      industry: name ?? props.industry,
      industries: register.industries.value,
      schemas: [...register.schemaDetails.value.values()].filter((s) => named.has(s.name)),
      assumptions: scoped,
      creator: readCreator(),
    })
    downloadBlob(new Blob([writeBundle(bundle)], { type: 'application/json' }), bundleFileName(name))
    notify(t('register.exported'))
  } catch (e) {
    reportError(e)
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  await controller.refreshConfiguration()
  await controller.refreshRows()
})
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <Input v-model="searchText" class="w-full max-w-sm" :placeholder="t('register.searchPlaceholder')" :aria-label="t('register.searchPlaceholder')">
        <template #start><Search /></template>
        <template v-if="searchText" #end>
          <Button size="icon-xs" variant="ghost" :aria-label="t('common.clear')" @click="controller.setSearch('')"><X /></Button>
        </template>
      </Input>
      <Menu align="start" class="max-h-96 w-64 overflow-y-auto">
        <template #trigger>
          <Button size="icon" variant="secondary" :aria-label="t('register.chooseColumns')" :title="t('register.chooseColumns')"><Columns3 /></Button>
        </template>
        <MenuLabel>{{ t('register.columns') }}</MenuLabel>
        <MenuCheckItem
          v-for="c in pickable"
          :key="c.colId"
          :checked="!hidden.includes(c.colId)"
          @update:checked="(v: boolean) => toggleColumn(c.colId, v)"
        >
          <span dir="auto" class="truncate">{{ c.headerName }}</span>
        </MenuCheckItem>
      </Menu>
      <div class="ms-auto flex flex-wrap items-center gap-2">
        <Button variant="secondary" @click="importOpen = true"><Upload /> {{ t('register.import') }}</Button>
        <Menu>
          <template #trigger>
            <Button variant="secondary" :loading="exporting"><Download v-if="!exporting" /> {{ t('register.export') }}</Button>
          </template>
          <MenuItem :disabled="controller.total.value === 0" @select="exportSheet">
            <template #icon><FileSpreadsheet /></template>{{ t('register.exportSheet') }}
          </MenuItem>
          <MenuItem :disabled="exporting" @select="exportBundle">
            <template #icon><FileJson /></template>{{ t('register.exportBundle') }}
          </MenuItem>
        </Menu>
        <Button variant="primary" @click="createOpen = true"><Plus /> {{ t('register.newAssumption') }}</Button>
      </div>
    </div>

    <div v-if="register.completing.value" class="flex flex-col gap-1.5">
      <Progress :value="progress.completed" :max="progress.total || 1" />
      <span class="text-[13px] text-muted-foreground">{{ t('register.reading', { done: progress.completed, total: progress.total }) }}</span>
    </div>

    <QuickFilters :columns="columns" :filters="controller.filterConditions.value" @update="onQuick" />
    <ActiveFilters
      :search="controller.search.value"
      :filters="controller.filterConditions.value"
      :columns="columns"
      @remove="onRemoveChip"
      @clear="clearAll"
    />

    <Card class="overflow-hidden">
      <RegisterTable
        v-if="controller.configuration.value"
        ref="table"
        :configuration="controller.configuration.value"
        :rows="controller.displayedRows.value"
        :registry="registry"
        :filters="filters"
        :context="context"
        :visible-columns="visibleColumns"
        :detail-component="AssumptionDetailRow"
        :detail-row-height="detailRowHeight"
        @models="onModels"
        @toggle="controller.toggleExpanded"
      />
      <div v-if="controller.total.value === 0 && (register.loading.value || register.completing.value)" class="space-y-2 p-5">
        <Skeleton v-for="n in 5" :key="n" class="h-9 w-full" />
      </div>
      <EmptyState v-else-if="!controller.loading.value && controller.total.value === 0" :title="emptyMessage" compact>
        <template #icon><Inbox v-if="register.assumptions.value.length === 0" /><SearchX v-else /></template>
      </EmptyState>
      <Pagination
        v-if="controller.total.value > 0"
        :page="controller.page.value"
        :page-size="controller.pageSize.value"
        :page-count="controller.pageCount.value"
        :total="controller.total.value"
        @update:page="controller.goToPage"
        @update:page-size="controller.setPageSize"
      />
    </Card>

    <CreateAssumptionDialog v-model:open="createOpen" :industry="industry" @created="onCreated" />
    <ImportBundleDialog v-model:open="importOpen" @restored="onRestored" />
  </div>
</template>
