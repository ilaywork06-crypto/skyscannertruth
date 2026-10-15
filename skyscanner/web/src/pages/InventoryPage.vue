<script setup lang="ts">
/**
 * The inventory (spec §4): industry tabs, the toolbar, quick filters and the active filters, the rows open
 * right now, the generated table and its pages - plus the dialogs it opens.
 */
import { Pagination, ActiveFilters, QuickFilters, isRowToggleClick, type GridRow } from '@truth-platform/grid'
import { AlertTriangle } from 'lucide-vue-next'
import { Button, Card, Dialog, PageHeader, Skeleton, translate as t } from '@truth-platform/ui'
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { downloadArtifact } from '@/api/artifacts'
import type { TableTemplate } from '@/api/templates'
import { provideSearchTerm } from '@/composables/useSearchTerm'
import { useInventory } from '@/composables/useInventory'
import CompareEventsDialog from '@/components/inventory/CompareEventsDialog.vue'
import EventsGrid from '@/components/inventory/EventsGrid.vue'
import ExpandedRows from '@/components/inventory/ExpandedRows.vue'
import FieldFilterDialog from '@/components/inventory/FieldFilterDialog.vue'
import ImportBundleDialog from '@/components/inventory/ImportBundleDialog.vue'
import IndustryTabs from '@/components/inventory/IndustryTabs.vue'
import InventoryToolbar from '@/components/inventory/InventoryToolbar.vue'
import SaveViewDialog from '@/components/inventory/SaveViewDialog.vue'
import FileViewerDialog from '@/components/viewer/FileViewerDialog.vue'

// The create wizard is built by another part of the client; it is wired in when present.
const wizards = import.meta.glob('../components/create/CreateEventWizard.vue')
const CreateEventWizard = wizards['../components/create/CreateEventWizard.vue']
  ? defineAsyncComponent(wizards['../components/create/CreateEventWizard.vue'] as () => Promise<{ default: object }>)
  : null

const inv = useInventory()
const { controller } = inv
provideSearchTerm(computed(() => controller.search.value))

/* ---------------- full screen */
const fullscreen = ref(false)
const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fullscreen.value && (fullscreen.value = false)
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

/* ---------------- rows */
function onRowClicked(row: GridRow, event: Event | null | undefined) {
  if (isRowToggleClick(event)) controller.toggleExpanded(String(row.id))
}

/* ---------------- views */
const saveOpen = ref(false)
const saving = ref(false)
/** After saving, what was waiting for it: a view to switch to, or the default view. */
let afterSave: (() => void) | null = null
let savingAsStep = false

async function chooseTemplate(tpl: TableTemplate) {
  if (!inv.isDirty()) return inv.applyTemplate(tpl)
  const choice = await ask(t('view.switchTitle'), t('view.switchBody', { name: tpl.name }), t('view.switchAnyway'))
  if (choice === 'go') inv.applyTemplate(tpl)
  else if (choice === 'save') startSave(() => inv.applyTemplate(tpl))
}
async function chooseDefault() {
  if (!inv.isDirty()) return inv.restoreDefaultView()
  const active = inv.templates.value.find((x) => x.id === inv.activeTemplateId.value)
  const body = active ? t('view.changedSince', { name: active.name }) : t('view.unsaved')
  const choice = await ask(t('view.restoreTitle'), body, t('view.discardAndRestore'))
  if (choice === 'go') inv.restoreDefaultView()
  else if (choice === 'save') startSave(() => inv.restoreDefaultView())
}
/** The three-way question about unsaved view changes: go on (losing them), save them first, or stay. */
const question = ref<{ title: string; body: string; go: string; resolve: (c: 'go' | 'save' | 'stay') => void } | null>(null)
function ask(title: string, body: string, go: string): Promise<'go' | 'save' | 'stay'> {
  return new Promise((resolve) => (question.value = { title, body, go, resolve }))
}
function answer(choice: 'go' | 'save' | 'stay') {
  const q = question.value
  question.value = null
  q?.resolve(choice)
}
function startSave(then: (() => void) | null) {
  afterSave = then
  savingAsStep = !!then
  saveOpen.value = true
}
async function onSave(draft: { name: string; description: string; shared: boolean }) {
  saving.value = true
  const created = await inv.saveTemplate(draft)
  saving.value = false
  if (!created) return
  saveOpen.value = false
  if (!savingAsStep) inv.markActive(created.id)
  else inv.rememberView()
  const next = afterSave
  afterSave = null
  savingAsStep = false
  next?.()
}
function onSaveDialog(open: boolean) {
  saveOpen.value = open
  if (!open) {
    afterSave = null
    savingAsStep = false
  }
}

/* ---------------- dialogs */
const filterOpen = ref(false)
function openFieldFilter() {
  filterOpen.value = true
  void inv.loadEntityColumns()
}
const importOpen = ref(false)
const createOpen = ref(false)
const compareOpen = ref(false)
const compareSource = ref<'selected' | 'expanded'>('selected')
const compareRows = computed(() => {
  const ids = compareSource.value === 'selected' ? inv.selectedIds.value : controller.expandedIds.value
  return ids.map((id) => inv.findRow(id)).filter((r): r is GridRow => !!r)
})
function compare(source: 'selected' | 'expanded') {
  compareSource.value = source
  compareOpen.value = true
}
function leaveComparison(id: string) {
  if (compareSource.value === 'selected') inv.deselect(id)
  else controller.toggleExpanded(id)
  if (compareRows.value.length < 2) compareOpen.value = false
}

const ready = computed(() => !!controller.configuration.value)
</script>

<template>
  <div>
    <PageHeader :title="t('nav.inventory')" :description="t('inventory.description')" />

    <div class="mb-4">
      <div v-if="!inv.industries.value.length" class="flex gap-2"><Skeleton v-for="i in 4" :key="i" class="h-8 w-28" /></div>
      <IndustryTabs v-else :industries="inv.industries.value" :picked="inv.picked.value" @change="inv.setPick" />
    </div>

    <div :class="fullscreen ? 'fixed inset-0 z-40 flex flex-col gap-3 overflow-hidden bg-background p-4' : 'flex flex-col gap-3'">
      <InventoryToolbar
        v-model:search="inv.searchText.value"
        v-model:parse-state="inv.parseState.value"
        :sort="controller.sortSpecifications.value"
        :columns="inv.columns.value"
        :visible-columns="inv.visibleColumns.value"
        :templates="inv.templates.value"
        :active-template-id="inv.activeTemplateId.value"
        :field-filter-count="inv.fieldFilters.value.length"
        :selected-count="inv.selectedIds.value.length"
        :all-selected="inv.selectedIds.value.length > 0 && inv.selectedIds.value.length === controller.rows.value.length"
        :archiving="inv.archiving.value"
        :fullscreen="fullscreen"
        @sort="inv.setSort"
        @toggle-column="inv.toggleColumn"
        @apply-template="chooseTemplate"
        @restore-view="chooseDefault"
        @save-view="startSave(null)"
        @open-filter="openFieldFilter"
        @fullscreen="fullscreen = !fullscreen"
        @export="inv.runExport"
        @import="importOpen = true"
        @compare="compare('selected')"
        @select-all="inv.toggleSelectAll"
        @new-event="createOpen = true"
      />
      <QuickFilters :columns="inv.columns.value" :filters="controller.filterConditions.value" @update="inv.onQuickFilter" />
      <ActiveFilters
        :search="inv.searchText.value"
        :scope="inv.scopeChip.value"
        :filters="inv.allFilters.value"
        :columns="inv.columns.value"
        :field-labels="inv.fieldLabels.value"
        @remove="inv.removeChip"
        @clear="inv.clearFilters"
      />
      <ExpandedRows
        :ids="controller.expandedIds.value"
        :find-row="inv.findRow"
        @reveal="inv.revealRow"
        @collapse="controller.toggleExpanded"
        @compare="compare('expanded')"
        @collapse-all="controller.collapseAll"
      />

      <Card :class="fullscreen ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'overflow-hidden'">
        <div v-if="!ready" class="flex flex-col gap-2 p-5">
          <Skeleton class="h-10" />
          <Skeleton v-for="i in 6" :key="i" class="h-11" />
        </div>
        <EventsGrid
          v-else
          :configuration="controller.configuration.value!"
          :rows="controller.displayedRows.value"
          :context="inv.context.value"
          :loading="controller.loading.value"
          :fullscreen="fullscreen"
          :find-row="inv.findRow"
          @ready="inv.onGridReady"
          @models="inv.onModels"
          @row-clicked="onRowClicked"
          @selection="(ids) => (inv.selectedIds.value = ids)"
        />
        <Pagination
          :page="controller.page.value"
          :page-size="controller.pageSize.value"
          :page-count="controller.pageCount.value"
          :total="controller.total.value"
          @update:page="controller.goToPage"
          @update:page-size="controller.setPageSize"
        />
      </Card>
    </div>

    <FieldFilterDialog
      v-model:open="filterOpen"
      :event-columns="inv.columns.value"
      :entity-columns="inv.entityColumns.value"
      :loading="inv.entityColumnsLoading.value"
      @apply="inv.addFieldFilter"
    />
    <CompareEventsDialog
      v-model:open="compareOpen"
      :rows="compareRows"
      :columns="inv.columns.value"
      :taxonomy="inv.taxonomy.value"
      @remove="leaveComparison"
      @open="inv.openArtifact"
      @download="downloadArtifact"
    />
    <ImportBundleDialog v-model:open="importOpen" @restored="inv.load" />
    <Dialog :open="!!question" size="sm" :title="question?.title" :description="question?.body" @update:open="(o) => !o && answer('stay')">
      <template #icon><AlertTriangle /></template>
      <template #footer>
        <Button variant="ghost" @click="answer('stay')">{{ t('common.cancel') }}</Button>
        <Button variant="secondary" @click="answer('save')">{{ t('view.saveFirst') }}</Button>
        <Button variant="primary" @click="answer('go')">{{ question?.go }}</Button>
      </template>
    </Dialog>
    <SaveViewDialog :open="saveOpen" :saving="saving" @update:open="onSaveDialog" @save="onSave" />
    <FileViewerDialog v-model:open="inv.viewerOpen.value" :artifact="inv.viewed.value" />
    <component
      :is="CreateEventWizard"
      v-if="CreateEventWizard"
      v-model:open="createOpen"
      :industry="inv.singleIndustry.value"
      @created="controller.refreshRows"
    />
  </div>
</template>
