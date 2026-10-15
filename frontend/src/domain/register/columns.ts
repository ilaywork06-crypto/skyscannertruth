/**
 * Generating the register's columns: the fixed ones the API declares on every assumption, then one per
 * attribute the industry's schemas declare.
 */

import type { Language, SchemeField } from '../scheme'
import { fieldLabel } from '../scheme'
import type { CellKind, ColumnDef, FilterKind } from './types'

type Translate = (key: string) => string

const VALUE_PREFIX = 'values'

/** Columns hidden on a table nobody has arranged yet. */
const DEFAULT_HIDDEN_COLUMNS: readonly string[] = ['schemas', 'revision']

const column = (input: Partial<ColumnDef> & Pick<ColumnDef, 'id' | 'label' | 'cell' | 'filter'>): ColumnDef => ({
  field: input.id,
  palette: 'neutral',
  width: 160,
  sortable: true,
  quick: false,
  dynamic: false,
  pinned: false,
  ...input,
})

const fixedColumns = (t: Translate): ColumnDef[] => [
  column({ id: 'assumption_text', label: t('column.assumption'), cell: 'longtext', filter: 'text', width: 380, pinned: true }),
  column({ id: 'industries', label: t('column.industries'), cell: 'chips', filter: 'set', palette: 'hashed', width: 180 }),
  column({ id: 'schemas', label: t('column.schemas'), cell: 'chips', filter: 'set', palette: 'hashed', width: 180 }),
  column({ id: 'proposing_party', label: t('column.proposingParty'), cell: 'chip', filter: 'set', width: 170, quick: true }),
  column({ id: 'validation_responsible_parties', label: t('column.validationBy'), cell: 'chips', filter: 'set', width: 180 }),
  column({ id: 'tags', label: t('column.tags'), cell: 'chips', filter: 'set', palette: 'hashed', width: 160, quick: true }),
  column({ id: 'revision', label: t('column.revision'), cell: 'number', filter: 'number', width: 90 }),
  column({ id: 'creator', label: t('column.creator'), cell: 'text', filter: 'set', width: 140, quick: true }),
  column({ id: 'created_at', label: t('column.createdAt'), cell: 'datetime', filter: 'date', width: 170 }),
]

const CELL_BY_TYPE: Record<SchemeField['type'], CellKind> = {
  string: 'text',
  boolean: 'boolean',
  confined_number: 'number',
  confined_float: 'number',
  enum: 'chip',
  ultra_enum: 'chip',
  date: 'date',
  multi_field: 'json',
}

const FILTER_BY_TYPE: Record<SchemeField['type'], FilterKind> = {
  string: 'text',
  boolean: 'set',
  confined_number: 'number',
  confined_float: 'number',
  enum: 'set',
  ultra_enum: 'set',
  date: 'date',
  multi_field: 'text',
}

const fieldColumn = (field: SchemeField, language: Language): ColumnDef => {
  const cell = field.array ? 'chips' : CELL_BY_TYPE[field.type]

  return column({
    id: field.key,
    field: `${VALUE_PREFIX}.${field.key}`,
    label: fieldLabel(field, language),
    cell,
    filter: field.array ? 'set' : FILTER_BY_TYPE[field.type],
    palette: cell === 'chip' || cell === 'chips' ? 'hashed' : 'neutral',
    width: cell === 'text' ? 200 : 150,
    quick: !field.array && (field.type === 'enum' || field.type === 'ultra_enum'),
    dynamic: true,
  })
}

/** Build every column for an industry's register. A declared key that collides with a fixed one is skipped. */
const buildColumns = (fields: SchemeField[], t: Translate, language: Language): ColumnDef[] => {
  const fixed = fixedColumns(t)
  const taken = new Set(fixed.map((item) => item.id))

  return [...fixed, ...fields.filter((field) => !taken.has(field.key)).map((field) => fieldColumn(field, language))]
}

const DEFAULT_SORT = [{ key: 'created_at', direction: 'desc' as const }]

export { DEFAULT_HIDDEN_COLUMNS, DEFAULT_SORT, VALUE_PREFIX, buildColumns }
