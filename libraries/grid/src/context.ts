/**
 * What a cell renderer may ask of the table it sits in. AG Grid mounts renderers outside the app's component
 * tree, so this travels in the grid's `context` rather than through provide/inject.
 */
import type { ICellRendererParams } from 'ag-grid-community'
import type { GridRow } from './types'

export interface TaxonomyItem {
  key: string
  name: string
  name_he?: string | null
  color?: string | null
  icon?: string | null
}

export interface GridContext {
  search: string
  taxonomy: TaxonomyItem[]
  expandedIds: string[]
  toggleExpanded(rowId: string): void
  openRow(rowId: string): void
  filterBy(colId: string, values: string[]): void
  openArtifact(artifact: Record<string, unknown>): void
  downloadArtifact(artifact: Record<string, unknown>): void
  findRow(rowId: string): GridRow | undefined
  rowLink(rowId: string): string | null
  /** Anything else a product hands its own renderers. */
  extra: Record<string, unknown>
}

export const EMPTY_CONTEXT: GridContext = {
  search: '',
  taxonomy: [],
  expandedIds: [],
  toggleExpanded: () => {},
  openRow: () => {},
  filterBy: () => {},
  openArtifact: () => {},
  downloadArtifact: () => {},
  findRow: () => undefined,
  rowLink: () => null,
  extra: {},
}

export function readContext(params: ICellRendererParams<GridRow>): GridContext {
  return (params.context as GridContext | undefined) ?? EMPTY_CONTEXT
}

export function readRowId(params: ICellRendererParams<GridRow>): string {
  return params.data ? String(params.data.id) : ''
}
