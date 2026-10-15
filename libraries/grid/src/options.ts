/** The grid options both tables are built with: detail rows, selection, text selection, row clicks. */
import { AllCommunityModule, ModuleRegistry, type CellClickedEvent, type GridOptions, type IRowNode, type PostSortRowsParams } from 'ag-grid-community'
import { observeThemeCompatibility } from './compatibility'
import { isDetailRow } from './controller'
import { parseColumnDefinitions, pinToReadingSide, type CellRendererRegistry, type FilterComponentRegistry } from './parse'
import type { GeneratedGridConfiguration, GridRow } from './types'

let registered = false
export function registerGridModules(): void {
  if (registered) return
  ModuleRegistry.registerModules([AllCommunityModule])
  registered = true
}

export const DEFAULT_DETAIL_HEIGHT = 320
const SELECTION_COLUMN_ID = 'ag-Grid-SelectionColumn'

/** Controls inside a row: pressing one is not a press on the row. */
const INTERACTIVE_TARGETS =
  'a, button, input, textarea, select, label, [role="button"], [role="checkbox"], .ag-selection-checkbox, .ag-checkbox-input-wrapper, [col-id="ag-Grid-SelectionColumn"]'

/** A press that toggles the row - not on a control, and not the end of selecting text to copy it. */
export function isRowToggleClick(event: Event | null | undefined): boolean {
  const target = event?.target as Element | null
  if (target?.closest?.(INTERACTIVE_TARGETS)) return false
  const selection = window.getSelection?.()
  return !(selection && selection.toString().length > 0)
}

/** Each detail row directly after its parent, whatever the sort did. */
function attachDetailRows(params: PostSortRowsParams<GridRow>): void {
  const nodes = params.nodes
  const details = new Map<string, IRowNode<GridRow>>()
  const plain: IRowNode<GridRow>[] = []
  for (const n of nodes) {
    if (isDetailRow(n.data)) details.set(String((n.data as GridRow).parentId), n)
    else plain.push(n)
  }
  const ordered: IRowNode<GridRow>[] = []
  for (const n of plain) {
    ordered.push(n)
    const d = details.get(String(n.data?.id))
    if (d) ordered.push(d)
  }
  nodes.splice(0, nodes.length, ...ordered)
}

/** A press anywhere in the tick-box cell ticks the row, not only on the box itself. */
function toggleFromSelectionCell(event: CellClickedEvent<GridRow>): void {
  if (event.column.getColId() !== SELECTION_COLUMN_ID || isDetailRow(event.data) || !event.node.selectable) return
  const target = event.event?.target as Element | null
  if (target?.closest?.('.ag-checkbox-input-wrapper, input')) return
  event.node.setSelected(!event.node.isSelected())
}

export interface GridOptionsInput {
  configuration: GeneratedGridConfiguration
  registry: CellRendererRegistry
  filters?: FilterComponentRegistry
  visibleColumns?: string[]
  rtl?: boolean
  selectable?: boolean
  detailRowHeight?: (parentId: string) => number
  onRowClicked?: (row: GridRow, event: Event | null | undefined) => void
}

export function buildGridOptions(input: GridOptionsInput): GridOptions<GridRow> {
  registerGridModules()
  if (typeof window !== 'undefined') setTimeout(() => observeThemeCompatibility(), 0)
  const columnDefs = pinToReadingSide(
    parseColumnDefinitions(input.configuration, { registry: input.registry, filters: input.filters, visibleColumns: input.visibleColumns }),
    !!input.rtl,
  )
  return {
    columnDefs,
    defaultColDef: { sortable: false, resizable: true, suppressHeaderMenuButton: true, cellClass: 'sky-cell', headerClass: 'sky-header' },
    headerHeight: input.configuration.headerHeight,
    animateRows: true,
    enableCellTextSelection: true,
    ensureDomOrder: true,
    suppressCellFocus: true,
    suppressDragLeaveHidesColumns: true,
    enableRtl: !!input.rtl,
    ...(input.selectable
      ? {
          rowSelection: {
            mode: 'multiRow' as const,
            checkboxes: true,
            headerCheckbox: true,
            enableClickSelection: false,
            selectAll: 'filtered' as const,
            isRowSelectable: (node: IRowNode<GridRow>) => !isDetailRow(node.data),
          },
          selectionColumnDef: { pinned: (input.rtl ? 'right' : 'left') as 'left' | 'right', lockPosition: (input.rtl ? 'right' : 'left') as 'left' | 'right', suppressMovable: true, width: 48 },
          onCellClicked: toggleFromSelectionCell,
        }
      : {}),
    postSortRows: attachDetailRows,
    getRowId: (p) => String(p.data.id),
    isFullWidthRow: (p) => isDetailRow(p.rowNode.data),
    getRowHeight: (p) => (isDetailRow(p.data) ? (input.detailRowHeight?.(String((p.data as GridRow).parentId)) ?? DEFAULT_DETAIL_HEIGHT) : input.configuration.rowHeight),
    getRowClass: (p) => (isDetailRow(p.data) ? 'sky-row sky-row--detail' : 'sky-row'),
    onGridReady: () => setTimeout(() => observeThemeCompatibility(), 0),
    onRowClicked: (e) => {
      if (e.data && !isDetailRow(e.data)) input.onRowClicked?.(e.data, e.event)
    },
  }
}
