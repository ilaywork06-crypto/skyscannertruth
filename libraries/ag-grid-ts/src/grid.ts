/**
 * Initialisation of AG Grid - the module registration and the grid options built from a generated configuration.
 */

import {
  AllCommunityModule,
  ModuleRegistry,
  type CellClickedEvent,
  type GridOptions,
  type IRowNode,
  type PostSortRowsParams,
  type RowClassParams,
  type ColDef,
} from 'ag-grid-community'

import { observeThemeCompatibility } from './compatibility'
import type { CellRendererRegistry, FilterComponentRegistry } from './parse'
import { parseColumnDefinitions } from './parse'
import type { GeneratedGridConfiguration, GridRow } from './types'

interface GridOptionsInput {
  configuration: GeneratedGridConfiguration
  registry: CellRendererRegistry
  filters?: FilterComponentRegistry
  visibleColumns?: string[]
  detailRowHeight?: number
  onRowClicked?: (row: GridRow) => void
  /**
   * Whether the rows can be ticked, which puts a column of checkboxes at the start of the table.
   *
   * Off unless a product asks for it, because a tick is only worth its column when something acts on it. An
   * inventory exports and archives the rows that were picked; a register has nothing that reads a
   * selection, so the column there was a column of controls that did nothing, pinned in front of the values
   * somebody opened the table for.
   */
  selectable?: boolean
}

const DETAIL_ROW_KEY = '__detail'
const DEFAULT_DETAIL_HEIGHT = 320

let modulesRegistered = false

/**
 * Register the AG Grid community modules exactly once per browser session.
 */
const registerGridModules = () => {
  if (modulesRegistered) {
    return
  }

  ModuleRegistry.registerModules([AllCommunityModule])
  modulesRegistered = true
}

/**
 * Give a browser without the colour function the palette the theme derived, and keep on giving it.
 *
 * The grid injects its generated stylesheet while it builds itself, so the first rewrite is queued behind
 * that rather than run before it. What follows is watched instead of assumed: the grid writes that sheet
 * again whenever the theme it is handed changes, and a rewrite left unanswered is a table that loses its
 * borders halfway through a session. On a browser that understands the function this does nothing at all.
 */
const repairInjectedTheme = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.setTimeout(() => observeThemeCompatibility(), 0)
}

/**
 * Decide whether one row of the table is a detail row rendered across the full width.
 */
const isDetailRow = (row: GridRow | undefined): boolean =>
  row !== undefined && row[DETAIL_ROW_KEY] === true

/**
 * Reattach every detail row directly underneath the row it belongs to.
 *
 * The ordering of the table is decided by the backend, but AG Grid still sorts the rows it was handed. A detail
 * row carries none of the sorted values, so it drifts away from its parent - to the top of the block for a
 * descending sort. Running after the sort, this puts each detail row back below its own row.
 */
const attachDetailRows = (params: PostSortRowsParams<GridRow>) => {
  const nodes = params.nodes
  const details = new Map<string, IRowNode<GridRow>>()
  const parents: IRowNode<GridRow>[] = []

  nodes.forEach((node) => {
    if (isDetailRow(node.data)) {
      details.set(String(node.data?.parentId ?? ''), node)

      return
    }
    parents.push(node)
  })

  const ordered: IRowNode<GridRow>[] = []
  parents.forEach((node) => {
    ordered.push(node)
    const detail = details.get(String(node.data?.id ?? ''))
    if (detail !== undefined) {
      ordered.push(detail)
    }
  })

  nodes.length = 0
  nodes.push(...ordered)
}

/** The column the grid draws the tick boxes of the rows in. */
const SELECTION_COLUMN_ID = 'ag-Grid-SelectionColumn'

/** The tick box itself, which answers its own presses before the cell around it hears of them. */
const CHECKBOX_TARGETS = '.ag-checkbox-input-wrapper, input'

/**
 * Tick or untick a row when its tick box cell is pressed anywhere, not only on the box.
 *
 * The box is a few pixels wide in a cell ten times that, and a press beside it - still plainly in the column
 * of boxes - used to do nothing at all. A press on the box itself is left to the box, which has already
 * acted on it.
 */
const toggleFromSelectionCell = (event: CellClickedEvent<GridRow>): void => {
  if (event.column.getColId() !== SELECTION_COLUMN_ID || isDetailRow(event.data) || !event.node.selectable) {
    return
  }

  const target = event.event?.target
  if (target instanceof Element && target.closest(CHECKBOX_TARGETS) !== null) {
    return
  }

  event.node.setSelected(!event.node.isSelected())
}

/**
 * What a click inside a row may land on without opening or closing the row: a link, a button, a checkbox, an
 * input, or a value that opens something of its own.
 */
const INTERACTIVE_TARGETS =
  'a, button, input, textarea, select, label, [role="button"], .v-btn, .ag-selection-checkbox, '
  + `.ag-checkbox-input-wrapper, .chip-list__plain--expandable, [col-id="${SELECTION_COLUMN_ID}"]`

/**
 * Decide whether a click on a row is a request to open or close its panel.
 *
 * A click that lands on something of its own - a link, a file, a tick box - is that thing's, and a click that
 * ends a drag across some text is somebody selecting it, so neither of them toggles the row.
 *
 * :param event: The browser event the grid reported the click with.
 * :return: Whether the row should be toggled.
 */
const isRowToggleClick = (event: Event | null | undefined): boolean => {
  const target = event?.target
  if (target instanceof Element && target.closest(INTERACTIVE_TARGETS) !== null) {
    return false
  }

  const selection = typeof window === 'undefined' ? null : window.getSelection()

  return selection === null || selection.toString().length === 0
}

/**
 * Pin every pinned column to the side a reader starts from, whichever way the table runs.
 *
 * The grid pins a column to the physical side it names in both directions, so a right to left table would
 * keep a column written as `left` on the left - at the end of each row rather than at its start. The sides are
 * swapped while the table runs right to left.
 *
 * :param definitions: The column definitions, written for a table that runs left to right.
 * :param rtl: Whether the table runs right to left.
 * :return: The same definitions, pinned for the direction the table runs in.
 */
const pinToReadingSide = <RowT>(definitions: ColDef<RowT>[], rtl: boolean): ColDef<RowT>[] => {
  if (!rtl) {
    return definitions
  }

  return definitions.map((definition) => {
    if (definition.pinned !== 'left' && definition.pinned !== 'right') {
      return definition
    }

    const side = definition.pinned === 'left' ? 'right' : 'left'

    return { ...definition, pinned: side, lockPosition: side }
  })
}

/**
 * Build the grid options of a table out of the configuration the backend generated.
 */
const buildGridOptions = (input: GridOptionsInput): GridOptions<GridRow> => {
  registerGridModules()
  repairInjectedTheme()

  const columnDefs: ColDef<GridRow>[] = parseColumnDefinitions(input.configuration, {
    registry: input.registry,
    filters: input.filters,
    visibleColumns: input.visibleColumns,
  })

  return {
    columnDefs,
    defaultColDef: {
      sortable: false,
      resizable: true,
      suppressHeaderMenuButton: true,
      suppressMovable: false,
      cellClass: 'sky-cell',
      headerClass: 'sky-header',
    },
    rowHeight: input.configuration.rowHeight,
    headerHeight: input.configuration.headerHeight,
    animateRows: true,
    /*
     * A reader has to be able to take a copy of what a cell says - an identifier to paste into a ticket, a
     * path, a name to search for somewhere else. The table library switches text selection off by default
     * and puts `ag-unselectable` on its own root to enforce it, which is what made the inventory the one
     * place in the system a pointer could not pick anything up. Turning it on asks for the rows to be
     * written in the order they are read as well, because a selection dragged across a table whose rows sit
     * in the document in some other order picks up those rows in that order.
     */
    enableCellTextSelection: true,
    ensureDomOrder: true,
    suppressCellFocus: true,
    suppressDragLeaveHidesColumns: true,
    ...(input.selectable === true
      ? {
          rowSelection: {
            mode: 'multiRow' as const,
            checkboxes: true,
            headerCheckbox: true,
            enableClickSelection: false,
            selectAll: 'filtered' as const,
            isRowSelectable: (node: IRowNode<GridRow>) => !isDetailRow(node.data),
          },
          selectionColumnDef: {
            pinned: 'left' as const,
            lockPosition: 'left' as const,
            suppressMovable: true,
            width: 50,
          },
          onCellClicked: toggleFromSelectionCell,
        }
      : {}),
    postSortRows: attachDetailRows,
    getRowId: (params) => String(params.data.id),
    isFullWidthRow: (params) => isDetailRow(params.rowNode.data),
    getRowHeight: (params) =>
      isDetailRow(params.data) ? (input.detailRowHeight ?? DEFAULT_DETAIL_HEIGHT) : input.configuration.rowHeight,
    getRowClass: (params: RowClassParams<GridRow>) =>
      isDetailRow(params.data) ? 'sky-row sky-row--detail' : 'sky-row',
    /* The palette of the table is written while it builds itself, and only from here on can it be watched. */
    onGridReady: repairInjectedTheme,
    onRowClicked: (event) => {
      if (input.onRowClicked !== undefined && event.data !== undefined && !isDetailRow(event.data)) {
        input.onRowClicked(event.data)
      }
    },
  }
}

export type { GridOptionsInput }
export { DETAIL_ROW_KEY, buildGridOptions, isDetailRow, isRowToggleClick, pinToReadingSide, registerGridModules }
