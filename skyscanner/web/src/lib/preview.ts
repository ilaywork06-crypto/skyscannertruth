/**
 * How a stored file is shown in the viewer (spec §8.2): the mode is decided from the content type and the
 * suffix; large text and delimited files are read in 1 MiB windows with HTTP ranges (a 206 is required, so a
 * multi-gigabyte file is never fetched whole by accident).
 */
import { suffixOf } from './icons'

export type PreviewMode = 'image' | 'video' | 'audio' | 'frame' | 'document' | 'table' | 'text' | 'unsupported'

export const MIB = 1024 * 1024
export const WINDOW_BYTES = MIB
export const WHOLE_TEXT_LIMIT = 2 * MIB
export const WORKBOOK_LIMIT = 16 * MIB
export const DOCUMENT_LIMIT = 24 * MIB
export const HEADING_BYTES = 64 * 1024
export const ROW_LIMIT = 501

const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']
const VIDEO = ['mp4', 'webm', 'ogv', 'mov', 'm4v']
const AUDIO = ['mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac']
const FRAME = ['pdf', 'html', 'htm']
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const DOCUMENT = ['docx', 'docm', 'dotx']
const WORKBOOK_TYPES = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
const WORKBOOK = ['xlsx', 'xlsm', 'xls']
const DELIMITED = ['csv', 'tsv', 'tab']
const TEXT = ['txt', 'log', 'json', 'yaml', 'yml', 'xml', 'md', 'ini', 'cfg', 'conf', 'py', 'js', 'ts', 'sql']

export interface PreviewSubject {
  name: string
  suffix?: string
  content_type?: string
  size_bytes?: number
}

export const isWorkbook = (s: PreviewSubject): boolean =>
  WORKBOOK_TYPES.includes((s.content_type ?? '').toLowerCase()) || WORKBOOK.includes(suffixOf(s.name, s.suffix))
export const isDelimited = (s: PreviewSubject): boolean =>
  DELIMITED.includes(suffixOf(s.name, s.suffix)) || (s.content_type ?? '').toLowerCase().includes('csv')

export function previewMode(s: PreviewSubject): PreviewMode {
  const suffix = suffixOf(s.name, s.suffix)
  const type = (s.content_type ?? '').toLowerCase()
  if (type.startsWith('image/') || IMAGE.includes(suffix)) return 'image'
  if (type.startsWith('video/') || VIDEO.includes(suffix)) return 'video'
  if (type.startsWith('audio/') || AUDIO.includes(suffix)) return 'audio'
  if (type === 'application/pdf' || FRAME.includes(suffix)) return 'frame'
  if (type === DOCX_TYPE || DOCUMENT.includes(suffix)) return 'document'
  if (isWorkbook(s) || isDelimited(s)) return 'table'
  if (type.startsWith('text/') || type.includes('json') || TEXT.includes(suffix)) return 'text'
  return 'unsupported'
}

/** Too large to open here (workbooks over 16 MiB, documents over 24 MiB). */
export function tooLarge(s: PreviewSubject, mode: PreviewMode): boolean {
  const size = s.size_bytes ?? 0
  if (mode === 'table' && isWorkbook(s)) return size > WORKBOOK_LIMIT
  if (mode === 'document') return size > DOCUMENT_LIMIT
  return false
}

/** Windowed reading: text or delimited files over 2 MiB (never workbooks). */
export const isWindowed = (s: PreviewSubject, mode: PreviewMode): boolean =>
  (mode === 'text' || (mode === 'table' && !isWorkbook(s))) && (s.size_bytes ?? 0) > WHOLE_TEXT_LIMIT

export class NotPartialError extends Error {}

/** Bytes `[start, end]` of the file (inclusive), refusing a whole-file answer. */
export async function readRange(url: string, start: number, end: number): Promise<string> {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } })
  if (res.status !== 206) throw new NotPartialError('The service answered with the whole file instead of the part asked for')
  const buf = await res.arrayBuffer()
  return new TextDecoder('utf-8').decode(buf)
}

/** The first sheet of a workbook, up to `rowLimit` rows, cells as formatted text. */
export async function readWorkbook(buffer: ArrayBuffer, rowLimit: number): Promise<{ rows: string[][]; truncated: boolean }> {
  const XLSX = await import('xlsx')
  const book = XLSX.read(buffer, { type: 'array' })
  const name = book.SheetNames[0]
  const sheet = name ? book.Sheets[name] : undefined
  if (!sheet || !sheet['!ref']) return { rows: [], truncated: false }
  const range = XLSX.utils.decode_range(sheet['!ref'])
  const last = Math.min(range.e.r, range.s.r + rowLimit - 1)
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
    range: { s: range.s, e: { r: last, c: range.e.c } },
  })
  return { rows: rows.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c)))), truncated: range.e.r > last }
}
