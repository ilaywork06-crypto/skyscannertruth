/** The view as a spreadsheet: the visible columns in order, each value flattened into one cell. */
import { downloadBlob } from '@truth-platform/ui'
import type { GeneratedColumn, GridRow, JsonValue } from '@truth-platform/grid'
import { utils, write } from 'xlsx'
import { fileStamp } from './bundle'

const SHEET_NAME = 'Assumptions'
const SKIPPED = ['expand']

export function toCell(value: JsonValue): string | number | boolean {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map((v) => String(toCell(v))).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}

export function readColumn(row: GridRow, column: GeneratedColumn): JsonValue {
  let cur: JsonValue = row as unknown as JsonValue
  for (const part of column.field.split('.')) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return null
    cur = (cur as Record<string, JsonValue>)[part] ?? null
  }
  return cur
}

export const sheetFileName = () => `truth-assumptions-${fileStamp()}.xlsx`

export function exportRows(rows: GridRow[], columns: GeneratedColumn[]): void {
  const exported = columns.filter((c) => !SKIPPED.includes(c.colId))
  const table = rows.map((row) => {
    const line: Record<string, string | number | boolean> = {}
    for (const c of exported) line[c.headerName.length > 0 ? c.headerName : c.colId] = toCell(readColumn(row, c))
    return line
  })
  const book = utils.book_new()
  utils.book_append_sheet(book, utils.json_to_sheet(table), SHEET_NAME)
  const buffer: ArrayBuffer = write(book, { bookType: 'xlsx', type: 'array' })
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), sheetFileName())
}
