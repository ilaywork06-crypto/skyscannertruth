/** The generated column definitions into AG Grid ColDefs, resolving renderer and filter names to components. */
import type { ColDef } from 'ag-grid-community'
import type { Component } from 'vue'
import type { GeneratedColumn, GeneratedGridConfiguration, GridRow } from './types'

export type CellRendererRegistry = Record<string, Component>
export type FilterComponentRegistry = Record<string, Component>

export interface ParseOptions {
  registry: CellRendererRegistry
  filters?: FilterComponentRegistry
  /** When given, exactly these columns are shown. */
  visibleColumns?: string[]
  hiddenColumns?: string[]
}

function isHidden(c: GeneratedColumn, o: ParseOptions): boolean {
  if (o.visibleColumns?.length) return !o.visibleColumns.includes(c.colId)
  if (o.hiddenColumns?.includes(c.colId)) return true
  return c.hide
}

export function parseColumn(c: GeneratedColumn, o: ParseOptions): ColDef<GridRow> {
  const def: ColDef<GridRow> = {
    colId: c.colId,
    field: c.field as ColDef<GridRow>['field'],
    headerName: c.headerName,
    sortable: c.sortable,
    resizable: c.resizable,
    editable: c.editable,
    hide: isHidden(c, o),
    filter: typeof c.filter === 'string' && o.filters?.[c.filter] ? o.filters[c.filter] : c.filter,
    floatingFilter: c.floatingFilter,
    cellDataType: c.cellDataType,
    autoHeight: c.autoHeight,
    wrapText: c.wrapText === true,
    cellRendererParams: { ...c.cellRendererParams },
    filterParams: { options: c.filterOptions, headerName: c.headerName },
    wrapHeaderText: true,
    autoHeaderHeight: true,
  }
  if (c.flex !== null) def.flex = c.flex
  if (c.minWidth !== null) def.minWidth = c.minWidth
  if (c.maxWidth !== null) def.maxWidth = c.maxWidth
  if (c.width !== null) def.width = c.width
  if (c.headerClass) def.headerClass = c.headerClass
  if (c.cellClass) def.cellClass = c.cellClass
  if (c.pinned === 'left' || c.pinned === 'right') {
    def.pinned = c.pinned
    def.lockPinned = true
    def.lockPosition = c.pinned
    def.suppressMovable = true
  }
  if (c.cellRenderer && o.registry[c.cellRenderer]) def.cellRenderer = o.registry[c.cellRenderer]
  return def
}

export function parseColumnDefinitions(config: GeneratedGridConfiguration, o: ParseOptions): ColDef<GridRow>[] {
  return config.columns.map((c) => parseColumn(c, o))
}

/** In a right-to-left table the start of a row is its right: what was pinned left moves right, and back. */
export function pinToReadingSide(defs: ColDef<GridRow>[], rtl: boolean): ColDef<GridRow>[] {
  if (!rtl) return defs
  return defs.map((d) => {
    if (d.pinned !== 'left' && d.pinned !== 'right') return d
    const side = d.pinned === 'left' ? 'right' : 'left'
    return { ...d, pinned: side, lockPosition: side }
  })
}

/** Headers in the page's language: the Hebrew one where the service named one. */
export function localiseColumns(config: GeneratedGridConfiguration, hebrew: boolean): GeneratedGridConfiguration {
  if (!hebrew) return config
  return { ...config, columns: config.columns.map((c) => (c.headerNameHebrew ? { ...c, headerName: c.headerNameHebrew } : c)) }
}
