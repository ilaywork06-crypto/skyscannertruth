<template>
  <div class="register">
    <RegisterToolbar
      :search="table.search.value"
      :columns="table.columns.value"
      :hidden-columns="table.hiddenColumns.value"
      :total="table.result.value.total"
      :exporting="exporting"
      @update:search="table.setSearch"
      @toggle-column="table.toggleColumn"
      @reset-columns="table.resetColumns"
      @create="createOpen = true"
      @import="importOpen = true"
      @export-sheet="exportSheet"
      @export-bundle="exportBundle"
    />

    <QuickFilters
      v-if="table.quickColumns.value.length > 0 && table.rows.value.length > 0"
      :columns="table.quickColumns.value"
      :options-for="table.quickOptions"
      :selected="table.valuesFor"
      @change="table.setColumnValues"
    />

    <ActiveFilters
      :search="table.search.value"
      :filters="table.filters.value"
      :columns="table.columns.value"
      @remove="table.removeFilter"
      @clear="table.clearAll"
      @clear-search="table.setSearch('')"
    />

    <div v-if="register.completing" class="register__progress">
      <v-progress-linear :model-value="progressPercent" color="primary" height="3" rounded />
      <span>{{ t('register.reading', register.progress) }}</span>
    </div>

    <RegisterTable
      v-if="loading || table.result.value.total > 0"
      :rows="table.result.value.rows"
      :columns="table.visibleColumns.value"
      :sort="table.sort.value"
      :filters="table.filters.value"
      :expanded="table.expanded.value"
      :search="table.search.value"
      :source="table.source"
      :loading="loading"
      @sort="table.toggleSort"
      @filter="table.setColumnFilter"
      @toggle="table.toggleExpanded"
    >
      <template #detail="{ row }">
        <AssumptionDetailPanel
          :row="row"
          :fields="table.fields.value"
          :narrowed-to="table.valuesFor"
          @filter="table.setColumnValues"
        />
      </template>
    </RegisterTable>

    <div v-else class="surface">
      <EmptyState
        v-if="table.isNarrowed.value"
        icon="mdi-filter-off-outline"
        :title="t('register.noMatch')"
        :text="t('register.noMatchHint')"
      >
        <v-btn variant="tonal" color="primary" @click="table.clearAll">{{ t('register.clearFilters') }}</v-btn>
      </EmptyState>
      <EmptyState v-else icon="mdi-lightbulb-on-outline" :title="t('register.empty')" :text="t('register.emptyHint')">
        <v-btn color="primary" prepend-icon="mdi-plus" @click="createOpen = true">{{ t('register.new') }}</v-btn>
      </EmptyState>
    </div>

    <TablePagination
      v-if="table.result.value.total > 0"
      :page="table.page.value"
      :page-size="table.pageSize.value"
      :page-count="table.pageCount.value"
      :total="table.result.value.total"
      @update:page="table.setPage"
      @update:page-size="table.setPageSize"
    />

    <AssumptionFormDialog v-model="createOpen" :industry-id="industryId" />
    <ImportBundleDialog v-model="importOpen" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'

import AssumptionFormDialog from '@/features/assumptions/components/AssumptionFormDialog.vue'
import ImportBundleDialog from '@/features/bundle/components/ImportBundleDialog.vue'
import { useBundleExport } from '@/features/bundle/composables/useBundleExport'
import { useI18n } from '@/i18n'
import EmptyState from '@/shared/components/EmptyState.vue'
import { exportSpreadsheet } from '@/shared/utils/spreadsheet'
import { useNotifications } from '@/stores/notifications'
import { usePreferences } from '@/stores/preferences'
import { useRegisterStore } from '@/stores/register'

import ActiveFilters from './components/ActiveFilters.vue'
import AssumptionDetailPanel from './components/AssumptionDetailPanel.vue'
import QuickFilters from './components/QuickFilters.vue'
import RegisterTable from './components/RegisterTable.vue'
import RegisterToolbar from './components/RegisterToolbar.vue'
import TablePagination from './components/TablePagination.vue'
import { useRegisterTable } from './composables/useRegisterTable'
import { useViewInAddress } from './composables/useViewInAddress'

const props = defineProps<{ industryId: string }>()

const { t } = useI18n()
const register = useRegisterStore()
const preferences = usePreferences()
const { notify, reportError } = useNotifications()
const { exporting, exportIndustry } = useBundleExport()

const table = useRegisterTable(toRef(props, 'industryId'))
useViewInAddress(table, (fullPath) => preferences.rememberRegister(props.industryId, fullPath))

const createOpen = ref(false)
const importOpen = ref(false)

/* Until details land, rows are not yet known to belong to this industry - show the table as loading. */
const loading = computed(
  () => register.state === 'loading' || (register.completing && table.rows.value.length === 0),
)

const progressPercent = computed(() =>
  register.progress.total === 0 ? 0 : (register.progress.done / register.progress.total) * 100,
)

/** The whole filtered, sorted view (every page), with the columns on screen. */
const exportSheet = async () => {
  try {
    const all = await table.source.readPage({ ...table.view.value, page: 1, pageSize: Number.MAX_SAFE_INTEGER })
    exportSpreadsheet(all.rows, table.visibleColumns.value)
    notify(t('register.exported'), 'success')
  } catch (error) {
    reportError(error)
  }
}

const exportBundle = async () => {
  try {
    await exportIndustry(props.industryId)
    notify(t('register.bundleExported'), 'success')
  } catch (error) {
    reportError(error)
  }
}
</script>

<style scoped>
.register {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.register__progress {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}

.register__progress .v-progress-linear {
  flex: 0 0 12rem;
}
</style>
