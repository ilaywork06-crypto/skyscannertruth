/**
 * The state of the inventory page (spec §4): the industry pick, the generated table and its page of rows, the
 * search / parse state / filters / sort that produce it, saved views with their unsaved-changes fingerprint,
 * selection, expanded rows and exports. The AG Grid instance is a projection of this state: whenever a grid is
 * (re)built - another configuration, another language - the state is pushed into it again.
 */
import type { ColumnState, FilterModel, GridApi, SortModelItem } from 'ag-grid-community'
import { downloadBlob, notify, reportError, translate as t, usePreferences } from '@truth-platform/ui'
import {
  buildFilterConditions, buildFilterModel, buildSortSpecifications, createGridController, withLocalDays,
  type FilterChip, type FilterCondition, type GridContext, type GridRow, type QuickFilterChoice, type SortSpecification, type TaxonomyItem,
} from '@truth-platform/grid'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { downloadArchive, downloadArtifact, type Artifact } from '@/api/artifacts'
import {
  exportEventBundle, exportEventFiles, exportEvents, readEntityColumns, readEventColumns, readEventRows,
  type EventExportRequest, type ParseState,
} from '@/api/grid'
import { TAXONOMY_KEYS, listEventTypes, useIndustries } from '@/api/taxonomy'
import {
  createTemplate, listTemplates, readActiveTemplate, writeActiveTemplate, type TableTemplate, type TemplateColumn,
} from '@/api/templates'
import { localised, prepareInventoryConfiguration } from '@/lib/columns'
import { parsePickParam, readStoredPick, writeStoredPick } from '@/lib/industries'
import { statusTone } from '@/lib/tones'
import type { ExportKind } from '@/components/inventory/InventoryToolbar.vue'
import type { GeneratedColumn } from '@truth-platform/grid'

const SCOPE = 'event'
const SEARCH_DELAY_MS = 350

export function useInventory() {
  const route = useRoute()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { language } = usePreferences()
  const hebrew = computed(() => language.value === 'he')
  const { industries, loaded: industriesLoaded } = useIndustries()

  /* ---------------------------------------------------------------- industry pick */
  const rawPick = computed(() => parsePickParam(route.query.industries) ?? readStoredPick())
  const picked = computed(() => {
    if (!industriesLoaded.value) return rawPick.value
    const known = new Set(industries.value.map((i) => i.key))
    return rawPick.value.filter((k) => known.has(k))
  })
  const singleIndustry = computed(() => (picked.value.length === 1 ? picked.value[0] : null))
  function setPick(keys: string[]) {
    writeStoredPick(keys)
    void router.replace({ query: { ...route.query, industries: keys.join(',') } })
  }
  onMounted(() => {
    if (route.query.industries === undefined) void router.replace({ query: { ...route.query, industries: readStoredPick().join(',') } })
  })

  /* ---------------------------------------------------------------- the table */
  const parseState = ref<ParseState>('all')
  const fieldFilters = shallowRef<FilterCondition[]>([])
  const fieldLabels = ref<Record<string, string>>({})
  const visibleColumns = ref<string[]>([])
  const columnLayout = shallowRef<TemplateColumn[] | null>(null)
  const searchText = ref('')

  const controller = createGridController({
    pageSize: 25,
    loadConfiguration: async () => {
      const [config, types] = await Promise.all([
        readEventColumns(picked.value),
        queryClient.fetchQuery({ queryKey: TAXONOMY_KEYS.eventTypes(null), queryFn: () => listEventTypes() }),
      ])
      return prepareInventoryConfiguration(config, types, hebrew.value)
    },
    loadRows: (q) =>
      readEventRows({
        search: q.search,
        industry: null,
        industries: picked.value,
        parse_state: parseState.value,
        filters: withLocalDays([...q.filters, ...fieldFilters.value]),
        sort: q.sort,
        page: q.page,
        page_size: q.pageSize,
        columns: [],
      }),
  })
  const columns = computed<GeneratedColumn[]>(() => controller.configuration.value?.columns ?? [])
  const declared = computed(() => new Set(columns.value.map((c) => c.colId)))
  const filterComponents = computed(() => Object.fromEntries(columns.value.filter((c) => typeof c.filter === 'string').map((c) => [c.colId, c.filter as string])))
  const findRow = (id: string) => controller.rows.value.find((r) => String(r.id) === String(id))

  /* ---------------------------------------------------------------- the grid */
  const gridApi = shallowRef<GridApi<GridRow> | null>(null)
  let applying = 0
  const live = () => (gridApi.value && !gridApi.value.isDestroyed() ? gridApi.value : null)

  /** Changes made from here must not come back as "the user changed the grid". */
  function quietly(fn: (api: GridApi<GridRow>) => void) {
    const api = live()
    if (!api) return
    applying++
    try {
      fn(api)
    } finally {
      setTimeout(() => applying--, 120)
    }
  }

  function sortState(sort: SortSpecification[]): ColumnState[] {
    return sort.filter((s) => declared.value.has(s.key)).map((s, i) => ({ colId: s.key, sort: s.direction, sortIndex: i }))
  }

  function pushState() {
    quietly((api) => {
      if (columnLayout.value) {
        api.applyColumnState({
          state: columnLayout.value.filter((c) => declared.value.has(c.key)).map((c) => ({
            colId: c.key, hide: !visibleColumns.value.includes(c.key), width: c.width ?? undefined, pinned: (c.pinned as 'left' | 'right' | null) ?? null,
          })),
          applyOrder: true,
        })
      }
      api.applyColumnState({ state: columns.value.map((c) => ({ colId: c.colId, hide: !visibleColumns.value.includes(c.colId) })) })
      api.applyColumnState({ state: sortState(controller.sortSpecifications.value), defaultState: { sort: null } })
      api.setFilterModel(buildFilterModel(controller.filterConditions.value, filterComponents.value))
    })
  }

  function onGridReady(api: GridApi<GridRow>) {
    gridApi.value = api
    pushState()
  }

  function onModels(sortModel: SortModelItem[], filterModel: FilterModel) {
    if (applying > 0) return
    const current = controller.sortSpecifications.value
    // A sort on something that is not a column (created_at) is never shown in the headers: keep it.
    const sort = sortModel.length
      ? buildSortSpecifications(sortModel)
      : current.length && current.every((s) => !declared.value.has(s.key))
        ? current
        : (controller.configuration.value?.defaultSort ?? [])
    const filters = buildFilterConditions(filterModel)
    if (JSON.stringify(sort) === JSON.stringify(current) && JSON.stringify(filters) === JSON.stringify(controller.filterConditions.value)) return
    controller.sortSpecifications.value = sort
    controller.filterConditions.value = filters
    controller.goToPage(1)
  }

  /* ---------------------------------------------------------------- search, scope, sort */
  let searchTimer: ReturnType<typeof setTimeout> | null = null
  watch(searchText, (v) => {
    controller.search.value = v
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => controller.goToPage(1), SEARCH_DELAY_MS)
  })
  watch(parseState, () => controller.goToPage(1))
  function setSort(spec: SortSpecification) {
    controller.sortSpecifications.value = [spec]
    quietly((api) => api.applyColumnState({ state: sortState([spec]), defaultState: { sort: null } }))
    controller.goToPage(1)
  }

  /* ---------------------------------------------------------------- columns */
  function toggleColumn(colId: string) {
    const on = !visibleColumns.value.includes(colId)
    visibleColumns.value = on ? [...visibleColumns.value, colId] : visibleColumns.value.filter((c) => c !== colId)
    quietly((api) => api.setColumnsVisible([colId], on))
  }
  function displayedColumnIds(): string[] {
    const api = live()
    if (!api) return visibleColumns.value
    return api.getColumnState().filter((s) => !s.hide && declared.value.has(s.colId)).map((s) => s.colId)
  }

  /* ---------------------------------------------------------------- filters */
  function setColumnFilterValues(colId: string, values: string[]) {
    const api = live()
    if (!api) {
      const rest = controller.filterConditions.value.filter((c) => c.key !== colId)
      controller.filterConditions.value = values.length ? [...rest, { key: colId, operator: 'in', value: null, values }] : rest
      controller.goToPage(1)
      return
    }
    const model = { ...(api.getFilterModel() ?? {}) }
    if (values.length) model[colId] = { filterType: 'set', values }
    else delete model[colId]
    api.setFilterModel(model)
  }
  const onQuickFilter = (choice: QuickFilterChoice) => setColumnFilterValues(choice.colId, choice.values)

  function addFieldFilter(condition: FilterCondition, label: string) {
    fieldFilters.value = [...fieldFilters.value, condition]
    fieldLabels.value = { ...fieldLabels.value, [condition.key]: label }
    controller.goToPage(1)
  }
  const allFilters = computed(() => [...controller.filterConditions.value, ...fieldFilters.value])
  const scopeChip = computed(() =>
    parseState.value === 'all' ? null : { field: t('toolbar.show'), value: parseState.value === 'parsed' ? t('toolbar.parsed') : t('toolbar.notParsed') },
  )
  function removeChip(chip: FilterChip) {
    if (chip.kind === 'search') searchText.value = ''
    else if (chip.kind === 'scope') parseState.value = 'all'
    else if (chip.index < controller.filterConditions.value.length) setColumnFilterValues(chip.colId, [])
    else {
      const i = chip.index - controller.filterConditions.value.length
      fieldFilters.value = fieldFilters.value.filter((_, k) => k !== i)
      controller.goToPage(1)
    }
  }
  function clearFilters() {
    searchText.value = ''
    controller.search.value = ''
    parseState.value = 'all'
    fieldFilters.value = []
    const hadGrid = controller.filterConditions.value.length > 0
    if (hadGrid && live()) live()!.setFilterModel(null)
    else {
      controller.filterConditions.value = []
      controller.goToPage(1)
    }
  }

  /* ---------------------------------------------------------------- saved views */
  const templates = shallowRef<TableTemplate[]>([])
  const activeTemplateId = ref<string | null>(null)
  const savedFingerprint = ref<string | null>(null)

  function layoutColumns(): { key: string; visible: boolean; order: number; pinned: string | null; width: number | null }[] {
    const api = live()
    const state = api ? api.getColumnState().filter((s) => declared.value.has(s.colId)) : null
    if (!state) return columns.value.map((c, i) => ({ key: c.colId, visible: visibleColumns.value.includes(c.colId), order: i, pinned: null, width: null }))
    return state.map((s, i) => ({ key: s.colId, visible: !s.hide, order: i, pinned: (s.pinned as string | null) ?? null, width: s.width ?? null }))
  }
  function fingerprint(): string {
    return JSON.stringify({
      columns: layoutColumns().map(({ key, visible, order, pinned }) => ({ key, visible, order, pinned })),
      sort: controller.sortSpecifications.value,
      filters: allFilters.value,
      search: searchText.value,
      parseState: parseState.value,
    })
  }
  function rememberView() {
    void nextTick(() => setTimeout(() => (savedFingerprint.value = fingerprint()), 150))
  }
  const isDirty = () => savedFingerprint.value !== null && savedFingerprint.value !== fingerprint()

  async function loadTemplates() {
    try {
      templates.value = await listTemplates(SCOPE, singleIndustry.value)
    } catch (e) {
      templates.value = []
      reportError(e)
    }
  }

  function applyTemplate(tpl: TableTemplate) {
    const ordered = [...tpl.columns].sort((a, b) => a.order - b.order)
    const known = new Set(ordered.map((c) => c.key))
    columns.value.forEach((c) => {
      if (!known.has(c.colId)) ordered.push({ key: c.colId, visible: !c.hide, order: ordered.length, width: null, pinned: null })
    })
    visibleColumns.value = ordered.filter((c) => c.visible && declared.value.has(c.key)).map((c) => c.key)
    const onColumns = tpl.filters.filter((f) => declared.value.has(f.key))
    fieldFilters.value = tpl.filters.filter((f) => !declared.value.has(f.key))
    controller.filterConditions.value = buildFilterConditions(buildFilterModel(onColumns, filterComponents.value))
    if (tpl.sort.length) controller.sortSpecifications.value = tpl.sort
    columnLayout.value = ordered
    pushState()
    controller.goToPage(1)
    activeTemplateId.value = tpl.id
    writeActiveTemplate(SCOPE, singleIndustry.value, tpl.id)
    rememberView()
  }

  function restoreDefaultView(announce = true) {
    visibleColumns.value = columns.value.filter((c) => !c.hide).map((c) => c.colId)
    searchText.value = ''
    controller.search.value = ''
    parseState.value = 'all'
    fieldFilters.value = []
    controller.filterConditions.value = []
    controller.sortSpecifications.value = controller.configuration.value?.defaultSort ?? []
    columnLayout.value = null
    quietly((api) => api.resetColumnState())
    pushState()
    controller.goToPage(1)
    activeTemplateId.value = null
    writeActiveTemplate(SCOPE, singleIndustry.value, null)
    rememberView()
    if (announce) notify(t('view.restored'))
  }

  async function saveTemplate(draft: { name: string; description: string; shared: boolean }): Promise<TableTemplate | null> {
    try {
      const created = await createTemplate({
        name: draft.name,
        description: draft.description,
        scope: SCOPE,
        industry: singleIndustry.value,
        shared: draft.shared,
        columns: layoutColumns().map(({ key, visible, order, width, pinned }) => ({ key, visible, order, width, pinned })),
        filters: allFilters.value,
        sort: controller.sortSpecifications.value,
      })
      templates.value = [...templates.value.filter((x) => x.id !== created.id), created]
      notify(t('view.saved'))
      return created
    } catch (e) {
      reportError(e)
      return null
    }
  }
  function markActive(id: string) {
    activeTemplateId.value = id
    writeActiveTemplate(SCOPE, singleIndustry.value, id)
    rememberView()
  }

  function restoreRememberedTemplate() {
    const id = readActiveTemplate(SCOPE, singleIndustry.value)
    if (!id) {
      activeTemplateId.value = null
      return
    }
    const tpl = templates.value.find((x) => x.id === id)
    if (tpl) applyTemplate(tpl)
    else {
      writeActiveTemplate(SCOPE, singleIndustry.value, null)
      activeTemplateId.value = null
    }
  }

  /* ---------------------------------------------------------------- loading */
  const entityColumns = shallowRef<GeneratedColumn[]>([])
  const entityColumnsLoading = ref(false)
  async function loadEntityColumns() {
    if (entityColumns.value.length || entityColumnsLoading.value) return
    entityColumnsLoading.value = true
    try {
      const scopes = picked.value.length ? picked.value : [null]
      const configs = await Promise.all(scopes.map((k) => readEntityColumns(k)))
      const seen = new Map<string, GeneratedColumn>()
      for (const c of configs) for (const col of localised(c, hebrew.value).columns) if (!seen.has(col.colId)) seen.set(col.colId, col)
      entityColumns.value = [...seen.values()]
    } catch (e) {
      reportError(e)
    } finally {
      entityColumnsLoading.value = false
    }
  }

  async function load() {
    entityColumns.value = []
    controller.sortSpecifications.value = []
    columnLayout.value = null
    await controller.refreshConfiguration()
    if (controller.errorMessage.value) reportError(new Error(controller.errorMessage.value))
    visibleColumns.value = columns.value.filter((c) => !c.hide).map((c) => c.colId)
    controller.filterConditions.value = controller.filterConditions.value.filter((c) => declared.value.has(c.key))
    await nextTick()
    pushState()
    await controller.refreshRows()
    rememberView()
    await loadTemplates()
    restoreRememberedTemplate()
  }

  watch(() => picked.value.join(','), () => {
    controller.collapseAll()
    controller.page.value = 1
    void load()
  }, { immediate: true })

  watch(language, async () => {
    entityColumns.value = []
    await controller.refreshConfiguration()
    await nextTick()
    pushState()
  })

  /* ---------------------------------------------------------------- selection, expansion */
  const selectedIds = ref<string[]>([])
  watch(() => controller.rows.value, () => (selectedIds.value = []))
  function toggleSelectAll() {
    quietly((api) => {
      if (selectedIds.value.length !== controller.rows.value.length) api.selectAll('filtered')
      else api.deselectAll()
    })
  }
  function deselect(id: string) {
    live()?.getRowNode(id)?.setSelected(false)
  }
  function revealRow(id: string) {
    const rows = document.querySelectorAll<HTMLElement>(`.sky-inventory-grid .ag-row[row-id="${CSS.escape(id)}"]`)
    rows[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    rows.forEach((el) => {
      el.classList.remove('sky-row--flash')
      void el.offsetWidth
      el.classList.add('sky-row--flash')
      setTimeout(() => el.classList.remove('sky-row--flash'), 1600)
    })
  }

  /* ---------------------------------------------------------------- exports */
  const archiving = ref(false)
  function exportRequest(selectionOnly: boolean): EventExportRequest {
    return {
      search: searchText.value.trim() || null,
      industry: null,
      industries: picked.value,
      parse_state: parseState.value,
      filters: withLocalDays(allFilters.value),
      sort: controller.sortSpecifications.value,
      page: 1,
      page_size: 500,
      columns: displayedColumnIds(),
      event_ids: selectionOnly ? [...selectedIds.value] : [],
    }
  }
  async function runExport(kind: ExportKind, selectionOnly: boolean) {
    const body = exportRequest(selectionOnly)
    archiving.value = true
    try {
      if (kind === 'csv' || kind === 'json') {
        const { blob, fileName } = await exportEvents(body, kind)
        downloadBlob(blob, fileName)
        notify(selectionOnly ? t('inventory.exportedSelected', { count: body.event_ids.length }) : t('inventory.exported'))
      } else if (kind === 'files') {
        const manifest = await exportEventFiles(body)
        if (!manifest.entries.length) throw new Error(t('export.noFiles'))
        notify(t('inventory.packing'), 'info')
        await downloadArchive(manifest)
        notify(t('inventory.packed'))
      } else {
        const manifest = await exportEventBundle(body)
        notify(t('bundle.packing'), 'info')
        await downloadArchive(manifest)
        notify(t('bundle.packed'))
      }
    } catch (e) {
      reportError(e)
    } finally {
      archiving.value = false
    }
  }

  /* ---------------------------------------------------------------- viewer, context */
  const viewerOpen = ref(false)
  const viewed = ref<Artifact | null>(null)
  function openArtifact(a: Artifact) {
    viewed.value = a
    viewerOpen.value = true
  }
  const taxonomy = computed<TaxonomyItem[]>(() => industries.value.map((i) => ({ key: i.key, name: i.name, name_he: i.name_he, icon: i.icon, color: '' })))
  const context = computed<GridContext>(() => ({
    search: controller.search.value,
    taxonomy: taxonomy.value,
    expandedIds: controller.expandedIds.value,
    toggleExpanded: controller.toggleExpanded,
    openRow: (id) => void router.push(`/events/${encodeURIComponent(id)}`),
    filterBy: setColumnFilterValues,
    openArtifact: (a) => openArtifact(a as unknown as Artifact),
    downloadArtifact: (a) => downloadArtifact(a as unknown as Artifact),
    findRow,
    rowLink: (id) => router.resolve(`/events/${encodeURIComponent(id)}`).href,
    extra: { toneFor: statusTone },
  }))

  onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer)
  })

  return {
    // pick
    industries, picked, singleIndustry, setPick,
    // table
    controller, columns, findRow, taxonomy, context, visibleColumns, searchText, parseState, fieldFilters, fieldLabels, allFilters, scopeChip,
    gridApi, onGridReady, onModels, setSort, toggleColumn, onQuickFilter, addFieldFilter, removeChip, clearFilters, load,
    entityColumns, entityColumnsLoading, loadEntityColumns,
    // views
    templates, activeTemplateId, isDirty, applyTemplate, restoreDefaultView, saveTemplate, markActive, rememberView,
    // selection, expansion
    selectedIds, toggleSelectAll, deselect, revealRow,
    // exports, viewer
    archiving, runExport, viewerOpen, viewed, openArtifact,
  }
}
