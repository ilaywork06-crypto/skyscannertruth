/** The wire shapes of the generated table - exactly as the services send them (camelCase configuration). */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type SortDirection = 'asc' | 'desc'
export type FilterOperator =
  | 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'greater_than' | 'greater_or_equal' | 'less_than' | 'less_or_equal'
  | 'in' | 'not_in' | 'between' | 'is_empty' | 'is_not_empty'

export interface SortSpecification {
  key: string
  direction: SortDirection
}

export interface FilterCondition {
  key: string
  operator: FilterOperator
  value: JsonValue
  values: JsonValue[]
}

export interface FilterOption {
  value: string
  label: string
  labelHebrew?: string
  icon?: string
}

export interface GeneratedColumn {
  colId: string
  field: string
  headerName: string
  headerNameHebrew: string
  sortable: boolean
  filter: string | boolean
  floatingFilter: boolean
  resizable: boolean
  hide: boolean
  editable: boolean
  flex: number | null
  minWidth: number | null
  maxWidth: number | null
  width: number | null
  pinned: string | null
  cellRenderer: string | null
  cellRendererParams: Record<string, JsonValue>
  cellDataType: string | boolean
  headerClass: string | null
  cellClass: string | null
  autoHeight: boolean
  wrapText?: boolean
  fieldType: string
  dynamic: boolean
  discovered: boolean
  industry: string | null
  filterOptions: FilterOption[]
  quickFilter: boolean
}

export interface GeneratedGridConfiguration {
  scope: string
  industry: string | null
  columns: GeneratedColumn[]
  defaultSort: SortSpecification[]
  quickFilterKeys: string[]
  rowHeight: number
  headerHeight: number
  version: string
}

export interface GridRow {
  id: string
  [key: string]: JsonValue
}

export interface GridRowsPage {
  rows: GridRow[]
  total: number
  page: number
  pageSize: number
  pages: number
}
