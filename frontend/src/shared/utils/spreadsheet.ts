/**
 * Writing rows out as an .xlsx file. Built in the browser from exactly what the table shows.
 */

import { utils, write } from 'xlsx'

import type { JsonValue } from '@/domain/json'
import { readPath } from '@/domain/json'
import { timestamp } from '@/domain/bundle'
import type { ColumnDef, RegisterRow } from '@/domain/register/types'

import { downloadBlob } from './download'

const toCell = (value: JsonValue): string | number | boolean => {
  if (value === null) return ''
  if (Array.isArray(value)) return value.map((item) => String(toCell(item))).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)

  return value
}

const exportSpreadsheet = (rows: RegisterRow[], columns: ColumnDef[], sheetName = 'Assumptions'): void => {
  const table = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column.label || column.id, toCell(readPath(row, column.field))])),
  )
  const book = utils.book_new()
  utils.book_append_sheet(book, utils.json_to_sheet(table), sheetName)
  const buffer: ArrayBuffer = write(book, { bookType: 'xlsx', type: 'array' })

  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `truth-assumptions-${timestamp()}.xlsx`,
  )
}

export { exportSpreadsheet, toCell }
