/**
 * The register's table configuration, built in the browser (the API generates none): nine fixed columns, then
 * one per field the industry's schemas declare. Same shape the services send the inventory, so the grid
 * library renders both alike.
 */
import { translate } from '@truth-platform/ui'
import type { GeneratedColumn, GeneratedGridConfiguration } from '@truth-platform/grid'
import { fieldLabel, renderType, type RenderType, type SchemeField } from './scheme'

export const VALUE_PREFIX = 'values'

const RENDERERS: Record<RenderType | 'text' | 'datetime', string> = {
  string: 'TextCellRenderer', text: 'TextCellRenderer', number: 'TextCellRenderer', integer: 'TextCellRenderer',
  boolean: 'BooleanCellRenderer', date: 'DateCellRenderer', datetime: 'DateCellRenderer', enum: 'ChipCellRenderer',
  json: 'JsonCellRenderer',
}
const FILTERS: Record<RenderType | 'text' | 'datetime', string> = {
  string: 'agTextColumnFilter', text: 'agTextColumnFilter', number: 'agNumberColumnFilter', integer: 'agNumberColumnFilter',
  boolean: 'SetColumnFilter', date: 'agDateColumnFilter', datetime: 'agDateColumnFilter', enum: 'SetColumnFilter',
  json: 'agTextColumnFilter',
}

interface ColumnInput {
  colId: string
  field: string
  headerName: string
  type: RenderType | 'text' | 'datetime'
  flex?: number
  width?: number
  pinned?: string
  minWidth: number
  renderer?: string
  filter?: string
  params?: Record<string, string | number | boolean | null>
  autoHeight?: boolean
  wrapText?: boolean
  quickFilter?: boolean
  dynamic?: boolean
  cellClass?: string
  hide?: boolean
  headerClass?: string
}

function toColumn(c: ColumnInput): GeneratedColumn {
  return {
    colId: c.colId,
    field: c.field,
    headerName: c.headerName,
    headerNameHebrew: '',
    sortable: true,
    filter: c.filter ?? FILTERS[c.type],
    floatingFilter: false,
    resizable: true,
    hide: c.hide ?? false,
    editable: false,
    flex: c.flex ?? null,
    minWidth: c.minWidth,
    maxWidth: null,
    width: c.width ?? null,
    pinned: c.pinned ?? null,
    cellRenderer: c.renderer ?? RENDERERS[c.type],
    cellRendererParams: c.params ?? {},
    cellDataType: false,
    headerClass: c.headerClass ?? null,
    cellClass: c.cellClass ?? 'sky-cell',
    autoHeight: c.autoHeight ?? false,
    wrapText: c.wrapText ?? false,
    fieldType: c.type,
    dynamic: c.dynamic ?? false,
    discovered: false,
    industry: null,
    filterOptions: [],
    quickFilter: c.quickFilter ?? false,
  }
}

export function fixedColumns(): GeneratedColumn[] {
  return [
    // The assumption itself is the first column, pinned to the side reading starts from, wrapped whole.
    toColumn({ colId: 'assumption_text', field: 'assumption_text', headerName: translate('column.assumptionText'), type: 'text', width: 420, minWidth: 240, pinned: 'left', autoHeight: true, wrapText: true }),
    toColumn({ colId: 'industries', field: 'industries', headerName: translate('column.industry'), type: 'enum', flex: 2, minWidth: 160, renderer: 'ChipListCellRenderer', filter: 'SetColumnFilter', params: { palette: 'industry' }, autoHeight: true }),
    toColumn({ colId: 'schemas', field: 'schemas', headerName: translate('column.schemas'), type: 'enum', flex: 2, minWidth: 160, renderer: 'ChipListCellRenderer', filter: 'SetColumnFilter', params: { palette: 'hashed' }, autoHeight: true }),
    toColumn({ colId: 'proposing_party', field: 'proposing_party', headerName: translate('column.proposingParty'), type: 'string', flex: 1, minWidth: 190, renderer: 'ChipCellRenderer', filter: 'SetColumnFilter', quickFilter: true }),
    toColumn({ colId: 'validation_responsible_parties', field: 'validation_responsible_parties', headerName: translate('column.validationBy'), type: 'enum', flex: 2, minWidth: 180, renderer: 'ChipListCellRenderer', filter: 'SetColumnFilter', autoHeight: true }),
    toColumn({ colId: 'tags', field: 'tags', headerName: translate('column.tags'), type: 'enum', flex: 2, minWidth: 150, renderer: 'ChipListCellRenderer', filter: 'SetColumnFilter', autoHeight: true, quickFilter: true }),
    toColumn({ colId: 'revision', field: 'revision', headerName: translate('column.revision'), type: 'integer', width: 90, minWidth: 80 }),
    toColumn({ colId: 'creator', field: 'creator', headerName: translate('column.creator'), type: 'string', flex: 1, minWidth: 140, renderer: 'ChipCellRenderer', filter: 'SetColumnFilter', quickFilter: true }),
    toColumn({ colId: 'created_at', field: 'created_at', headerName: translate('column.createdAt'), type: 'datetime', flex: 1, minWidth: 170, params: { withTime: true }, cellClass: 'sky-cell sky-cell--stamp', headerClass: 'sky-header sky-header--end' }),
  ]
}

export function fieldColumn(field: SchemeField): GeneratedColumn {
  const rendered = renderType(field.type)
  return toColumn({
    colId: field.key,
    field: `${VALUE_PREFIX}.${field.key}`,
    headerName: fieldLabel(field),
    type: rendered,
    flex: 1,
    minWidth: 140,
    renderer: field.array ? 'ChipListCellRenderer' : RENDERERS[rendered],
    filter: field.array || rendered === 'enum' ? 'SetColumnFilter' : FILTERS[rendered],
    autoHeight: field.array || rendered === 'string',
    wrapText: !field.array && rendered === 'string',
    quickFilter: rendered === 'enum' && !field.array,
    dynamic: true,
  })
}

/** The signature that, when it changes, rebuilds the table (and resets its arrangement and sort). */
export const fieldsSignature = (fields: SchemeField[]) => fields.map((f) => `${f.key}:${f.type}`).join(',')

export function buildConfiguration(fields: SchemeField[], language: string): GeneratedGridConfiguration {
  return {
    scope: 'assumption',
    industry: null,
    columns: [...fixedColumns(), ...fields.map(fieldColumn)],
    defaultSort: [{ key: 'created_at', direction: 'desc' }],
    quickFilterKeys: ['proposing_party', 'creator', 'tags'],
    rowHeight: 44,
    headerHeight: 44,
    version: `assumption:${language}:${fieldsSignature(fields)}`,
  }
}
