<script setup lang="ts">
/**
 * The inventory's toolbar (spec §4.4): search; Show (parsed / not parsed); Sort by; Columns; View (saved views);
 * Filter (by any field) - then full screen, Export / Import, Compare, Select all and + Event.
 */
import {
  ArrowDownWideNarrow, ArrowUpNarrowWide, Bookmark, BookmarkCheck, Check, ChevronDown, Columns3, Download, FileJson, FileSpreadsheet,
  FilterIcon, FolderArchive, GitCompareArrows, Maximize2, Minimize2, Package, Plus, RotateCcw, Save, Search, SquareCheck, Upload, X,
} from 'lucide-vue-next'
import { Button, Input, Menu, MenuCheckItem, MenuItem, MenuLabel, MenuSeparator, Tooltip, cn, translate as t } from '@truth-platform/ui'
import type { GeneratedColumn, SortSpecification } from '@truth-platform/grid'
import { computed } from 'vue'
import type { TableTemplate } from '@/api/templates'
import type { ParseState } from '@/api/grid'
import { UNLISTED_COLUMNS } from '@/lib/columns'

export type ExportKind = 'csv' | 'json' | 'files' | 'bundle'

const props = defineProps<{
  parseState: ParseState
  sort: SortSpecification[]
  columns: GeneratedColumn[]
  visibleColumns: string[]
  templates: TableTemplate[]
  activeTemplateId: string | null
  fieldFilterCount: number
  selectedCount: number
  allSelected: boolean
  archiving: boolean
  fullscreen: boolean
}>()
const search = defineModel<string>('search', { default: '' })
const emit = defineEmits<{
  'update:parseState': [state: ParseState]
  sort: [spec: SortSpecification]
  toggleColumn: [colId: string]
  applyTemplate: [template: TableTemplate]
  restoreView: []
  saveView: []
  openFilter: []
  fullscreen: []
  export: [kind: ExportKind, selectionOnly: boolean]
  import: []
  compare: []
  selectAll: []
  newEvent: []
}>()

const pill = 'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors'
const idle = 'border-border bg-card text-foreground hover:bg-muted'
const lit = 'border-primary/40 bg-primary-soft text-primary-soft-foreground'

const parsed = computed(() => props.parseState !== 'not_parsed')
const notParsed = computed(() => props.parseState !== 'parsed')
const showLabel = computed(() => (props.parseState === 'all' ? t('toolbar.all') : props.parseState === 'parsed' ? t('toolbar.parsed') : t('toolbar.notParsed')))
function setShow(which: 'parsed' | 'not_parsed', on: boolean) {
  const p = which === 'parsed' ? on : parsed.value
  const n = which === 'not_parsed' ? on : notParsed.value
  if (!p && !n) return
  emit('update:parseState', p && n ? 'all' : p ? 'parsed' : 'not_parsed')
}

const sortOptions = computed(() => {
  const out = props.columns.filter((c) => c.sortable && c.headerName).map((c) => ({ key: c.colId, label: c.headerName }))
  if (!out.some((o) => o.key === 'created_at')) out.push({ key: 'created_at', label: t('event.createdAt') })
  return out
})
const current = computed(() => props.sort[0] ?? { key: 'created_at', direction: 'desc' as const })
const sortLabel = computed(() => sortOptions.value.find((o) => o.key === current.value.key)?.label ?? current.value.key)
const sortWidth = computed(() => `${Math.min(14, Math.max(8, ...sortOptions.value.map((o) => o.label.length))) * 0.95}ch`)

const listed = computed(() => props.columns.filter((c) => !UNLISTED_COLUMNS.has(c.colId)))
const active = computed(() => props.templates.find((x) => x.id === props.activeTemplateId) ?? null)
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <Input v-model="search" class="w-full sm:w-64" :placeholder="t('toolbar.search')" dir="auto" type="search" :aria-label="t('toolbar.search')">
        <template #start><Search /></template>
        <template v-if="search" #end>
          <button type="button" class="grid size-6 place-items-center rounded text-muted-foreground hover:text-foreground" :aria-label="t('common.clear')" @click="search = ''"><X class="size-3.5" /></button>
        </template>
      </Input>

      <Menu align="start">
        <template #trigger>
          <button type="button" :class="cn(pill, parseState === 'all' ? idle : lit)">
            <span class="text-muted-foreground">{{ t('toolbar.show') }}</span><span dir="auto">{{ showLabel }}</span><ChevronDown class="size-3.5 opacity-60" />
          </button>
        </template>
        <MenuCheckItem :checked="parsed" @update:checked="(v) => setShow('parsed', v)">{{ t('toolbar.parsed') }}</MenuCheckItem>
        <MenuCheckItem :checked="notParsed" @update:checked="(v) => setShow('not_parsed', v)">{{ t('toolbar.notParsed') }}</MenuCheckItem>
      </Menu>

      <Menu align="start" class="max-h-96 overflow-y-auto">
        <template #trigger>
          <button type="button" :class="cn(pill, idle)">
            <component :is="current.direction === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow" class="size-4 text-muted-foreground" />
            <span class="text-muted-foreground">{{ t('toolbar.sortBy') }}</span>
            <span class="truncate text-start" :style="{ width: sortWidth }" dir="auto">{{ sortLabel }}</span>
            <ChevronDown class="size-3.5 opacity-60" />
          </button>
        </template>
        <MenuItem v-for="o in sortOptions" :key="o.key" @select="emit('sort', { key: o.key, direction: current.direction })">
          <span dir="auto">{{ o.label }}</span>
          <Check v-if="o.key === current.key" class="ms-auto inline size-4 !text-primary" />
        </MenuItem>
        <MenuSeparator />
        <MenuItem @select="emit('sort', { key: current.key, direction: current.direction === 'asc' ? 'desc' : 'asc' })">
          <template #icon><component :is="current.direction === 'asc' ? ArrowUpNarrowWide : ArrowDownWideNarrow" /></template>
          {{ current.direction === 'asc' ? t('toolbar.ascending') : t('toolbar.descending') }}
        </MenuItem>
      </Menu>

      <Menu align="start" class="max-h-[28rem] w-64 overflow-y-auto">
        <template #trigger>
          <button type="button" :class="cn(pill, idle)"><Columns3 class="size-4 text-muted-foreground" />{{ t('toolbar.columns') }}</button>
        </template>
        <MenuCheckItem v-for="c in listed" :key="c.colId" :checked="visibleColumns.includes(c.colId)" @update:checked="emit('toggleColumn', c.colId)">
          <span class="flex min-w-0 flex-col">
            <span class="truncate" dir="auto">{{ c.headerName || c.colId }}</span>
            <span v-if="c.discovered" class="text-[11px] text-muted-foreground">{{ t('attributes.notDeclared') }}</span>
          </span>
        </MenuCheckItem>
      </Menu>

      <Menu align="start" class="w-72">
        <template #trigger>
          <button type="button" :class="cn(pill, active ? lit : idle)">
            <component :is="active ? BookmarkCheck : Bookmark" class="size-4" :class="!active && 'text-muted-foreground'" />
            <span :class="!active && 'text-muted-foreground'">{{ t('toolbar.view') }}</span>
            <span class="max-w-40 truncate" dir="auto">{{ active?.name ?? t('toolbar.defaultView') }}</span>
            <ChevronDown class="size-3.5 opacity-60" />
          </button>
        </template>
        <MenuItem v-for="tpl in templates" :key="tpl.id" @select="emit('applyTemplate', tpl)">
          <span class="flex min-w-0 flex-col">
            <span class="truncate" dir="auto">{{ tpl.name }}</span>
            <span class="text-xs text-muted-foreground">{{ tpl.shared ? t('toolbar.shared') : t('toolbar.private') }}</span>
          </span>
          <Check v-if="tpl.id === activeTemplateId" class="ms-auto inline size-4 !text-primary" />
        </MenuItem>
        <MenuSeparator v-if="templates.length" />
        <MenuItem @select="emit('restoreView')">
          <template #icon><RotateCcw /></template>{{ t('toolbar.defaultView') }}
          <Check v-if="!activeTemplateId" class="ms-auto inline size-4 !text-primary" />
        </MenuItem>
        <MenuItem @select="emit('saveView')"><template #icon><Save /></template>{{ t('toolbar.saveView') }}</MenuItem>
      </Menu>

      <button type="button" :class="cn(pill, fieldFilterCount ? lit : idle)" @click="emit('openFilter')">
        <FilterIcon class="size-4" :class="!fieldFilterCount && 'text-muted-foreground'" />{{ t('toolbar.filterFields') }}
        <span v-if="fieldFilterCount" class="rounded-full bg-primary px-1.5 text-[11px] leading-5 text-primary-foreground tabular-nums">{{ fieldFilterCount }}</span>
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <Tooltip :content="fullscreen ? t('toolbar.leaveFullscreen') : t('toolbar.fullscreen')">
        <Button size="icon" variant="ghost" :aria-label="fullscreen ? t('toolbar.leaveFullscreen') : t('toolbar.fullscreen')" @click="emit('fullscreen')">
          <component :is="fullscreen ? Minimize2 : Maximize2" />
        </Button>
      </Tooltip>
      <Menu class="w-72">
        <template #trigger>
          <Button variant="secondary" :loading="archiving" :aria-label="t('toolbar.export')"><Download v-if="!archiving" /> {{ t('toolbar.export') }}</Button>
        </template>
        <MenuLabel>{{ t('toolbar.wholeView') }}</MenuLabel>
        <MenuItem @select="emit('export', 'csv', false)"><template #icon><FileSpreadsheet /></template>{{ t('toolbar.exportCsv') }}</MenuItem>
        <MenuItem @select="emit('export', 'json', false)"><template #icon><FileJson /></template>{{ t('toolbar.exportJson') }}</MenuItem>
        <MenuItem @select="emit('export', 'files', false)"><template #icon><FolderArchive /></template>{{ t('toolbar.exportFiles') }}</MenuItem>
        <MenuItem @select="emit('export', 'bundle', false)"><template #icon><Package /></template>{{ t('toolbar.exportBundle') }}</MenuItem>
        <template v-if="selectedCount > 0">
          <MenuSeparator />
          <MenuLabel>{{ t('toolbar.selectedOnly', { count: selectedCount }) }}</MenuLabel>
          <MenuItem @select="emit('export', 'csv', true)"><template #icon><FileSpreadsheet /></template>{{ t('toolbar.exportCsv') }}</MenuItem>
          <MenuItem @select="emit('export', 'json', true)"><template #icon><FileJson /></template>{{ t('toolbar.exportJson') }}</MenuItem>
          <MenuItem @select="emit('export', 'files', true)"><template #icon><FolderArchive /></template>{{ t('toolbar.exportSelectedFiles') }}</MenuItem>
          <MenuItem @select="emit('export', 'bundle', true)"><template #icon><Package /></template>{{ t('toolbar.exportBundle') }}</MenuItem>
        </template>
        <MenuSeparator />
        <MenuLabel>{{ t('toolbar.intoInventory') }}</MenuLabel>
        <MenuItem @select="emit('import')"><template #icon><Upload /></template>{{ t('toolbar.import') }}</MenuItem>
      </Menu>
      <Button v-if="selectedCount > 1" variant="soft" @click="emit('compare')"><GitCompareArrows /> {{ t('toolbar.compare', { count: selectedCount }) }}</Button>
      <Button variant="soft" @click="emit('selectAll')">
        <SquareCheck /> {{ selectedCount > 0 ? t('toolbar.selected', { count: selectedCount }) : t('toolbar.selectAll') }}
      </Button>
      <Button variant="primary" @click="emit('newEvent')"><Plus /> {{ t('toolbar.newEvent') }}</Button>
    </div>
  </div>
</template>
