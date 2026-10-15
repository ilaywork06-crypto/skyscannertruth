/**
 * @truth-platform/grid - the generated table both clients render: AG Grid in the Lattice look, the column
 * configuration the services generate, filter and sort models in and out of the wire conditions, and the
 * repair of AG Grid's stylesheets for old browsers.
 */
import BooleanCell from './cells/BooleanCell.vue'
import ChipCell from './cells/ChipCell.vue'
import ChipListCell from './cells/ChipListCell.vue'
import CoordinateCell from './cells/CoordinateCell.vue'
import DateCell from './cells/DateCell.vue'
import ExpandCell from './cells/ExpandCell.vue'
import JsonCell from './cells/JsonCell.vue'
import StatusCell from './cells/StatusCell.vue'
import TextCell from './cells/TextCell.vue'
import SetColumnFilter from './filters/SetColumnFilter.vue'
import type { CellRendererRegistry, FilterComponentRegistry } from './parse'

export * from './types'
export * from './compatibility'
export * from './context'
export * from './controller'
export * from './datasource'
export * from './options'
export * from './parse'
export * from './theme'
export { chipLook, headerOf, readOptions, type ChipLook, type Palette } from './cells/look'
export { default as DataGrid } from './DataGrid.vue'
export { default as QuickFilters } from './QuickFilters.vue'
export { default as ActiveFilters } from './ActiveFilters.vue'
export { default as Pagination } from './Pagination.vue'
export type { QuickFilterChoice } from './QuickFilters.vue'
export type { FilterChip, ScopeFilter } from './ActiveFilters.vue'
export { BooleanCell, ChipCell, ChipListCell, CoordinateCell, DateCell, ExpandCell, JsonCell, SetColumnFilter, StatusCell, TextCell }

/** The renderer names the services' column configuration refers to. A product adds its own on top. */
export function baseRenderers(extra: CellRendererRegistry = {}): CellRendererRegistry {
  return {
    BooleanCellRenderer: BooleanCell,
    ChipCellRenderer: ChipCell,
    ChipListCellRenderer: ChipListCell,
    CoordinateCellRenderer: CoordinateCell,
    DateCellRenderer: DateCell,
    ExpandCellRenderer: ExpandCell,
    JsonCellRenderer: JsonCell,
    StatusCellRenderer: StatusCell,
    TextCellRenderer: TextCell,
    ...extra,
  }
}

export function baseFilters(extra: FilterComponentRegistry = {}): FilterComponentRegistry {
  return { SetColumnFilter, ...extra }
}

/** Column types as the services name them, to the renderer each is drawn with. */
export const TYPE_RENDERERS: Record<string, string> = {
  string: 'TextCellRenderer',
  text: 'TextCellRenderer',
  number: 'TextCellRenderer',
  integer: 'TextCellRenderer',
  boolean: 'BooleanCellRenderer',
  date: 'DateCellRenderer',
  datetime: 'DateCellRenderer',
  enum: 'ChipCellRenderer',
  file: 'FilesCellRenderer',
  json: 'JsonCellRenderer',
  coordinate: 'CoordinateCellRenderer',
}
