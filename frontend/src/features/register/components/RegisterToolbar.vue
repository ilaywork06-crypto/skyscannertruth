<template>
  <div class="toolbar">
    <v-text-field
      :model-value="search"
      class="toolbar__search"
      :placeholder="t('register.search')"
      prepend-inner-icon="mdi-magnify"
      density="compact"
      clearable
      single-line
      @update:model-value="emit('update:search', $event ?? '')"
    />

    <v-menu :close-on-content-click="false" location="bottom end" offset="6">
      <template #activator="{ props: activator }">
        <v-btn v-bind="activator" variant="tonal" prepend-icon="mdi-view-column-outline">
          {{ t('register.columns') }}
          <v-badge v-if="hiddenCount > 0" :content="hiddenCount" color="primary" inline />
        </v-btn>
      </template>
      <v-card width="280">
        <div class="columns-menu__head">
          <span>{{ t('register.columns') }}</span>
          <v-btn variant="text" size="small" @click="emit('reset-columns')">{{ t('register.columnsReset') }}</v-btn>
        </div>
        <v-divider />
        <div class="columns-menu__list">
          <v-checkbox
            v-for="column in columns"
            :key="column.id"
            :model-value="!hiddenColumns.includes(column.id)"
            @update:model-value="emit('toggle-column', column.id, $event === true)"
          >
            <template #label>
              <span class="bidi">{{ column.label }}</span>
              <v-icon v-if="column.dynamic" icon="mdi-shape-outline" size="13" class="ms-1 text-muted" />
            </template>
          </v-checkbox>
        </div>
      </v-card>
    </v-menu>

    <v-spacer class="toolbar__spacer" />

    <v-btn variant="tonal" prepend-icon="mdi-tray-arrow-up" @click="emit('import')">{{ t('register.import') }}</v-btn>

    <v-menu location="bottom end" offset="6">
      <template #activator="{ props: activator }">
        <v-btn v-bind="activator" variant="tonal" prepend-icon="mdi-tray-arrow-down" append-icon="mdi-chevron-down" :loading="exporting">
          {{ t('register.export') }}
        </v-btn>
      </template>
      <v-list density="comfortable" width="300" class="py-1">
        <v-list-item prepend-icon="mdi-file-excel-outline" :disabled="total === 0" @click="emit('export-sheet')">
          <v-list-item-title>{{ t('register.exportSheet') }}</v-list-item-title>
          <v-list-item-subtitle>{{ t('register.exportSheetHint') }}</v-list-item-subtitle>
        </v-list-item>
        <v-list-item prepend-icon="mdi-package-variant-closed" @click="emit('export-bundle')">
          <v-list-item-title>{{ t('register.exportBundle') }}</v-list-item-title>
          <v-list-item-subtitle>{{ t('register.exportBundleHint') }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </v-menu>

    <v-btn color="primary" prepend-icon="mdi-plus" @click="emit('create')">{{ t('register.new') }}</v-btn>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import type { ColumnDef } from '@/domain/register/types'
import { useI18n } from '@/i18n'

const props = defineProps<{
  search: string
  columns: ColumnDef[]
  hiddenColumns: string[]
  total: number
  exporting: boolean
}>()

const emit = defineEmits<{
  'update:search': [term: string]
  'toggle-column': [id: string, visible: boolean]
  'reset-columns': []
  create: []
  import: []
  'export-sheet': []
  'export-bundle': []
}>()

const { t } = useI18n()

const hiddenCount = computed(() => props.columns.filter((column) => props.hiddenColumns.includes(column.id)).length)
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.toolbar__search {
  flex: 0 1 26rem;
  min-inline-size: 14rem;
}

@media (max-width: 700px) {
  .toolbar__search {
    flex-basis: 100%;
  }

  .toolbar__spacer {
    display: none;
  }
}

.columns-menu__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.6rem 0.6rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.columns-menu__list {
  max-block-size: 22rem;
  overflow-y: auto;
  padding: 0.4rem 0.6rem;
}

.columns-menu__list :deep(.v-label) {
  font-size: 0.8125rem;
  opacity: 1;
}
</style>
