/**
 * The generated table of events: its column configuration, a page of rows, and everything that carries the
 * current view out of the page (exports, file archives, bundles) or a bundle into it (spec §4.11, §4.17-4.18).
 */
import type { FilterCondition, GeneratedGridConfiguration, GridRowsPage, SortSpecification } from '@truth-platform/grid'
import { api, send } from './client'
import { UPLOAD_TIMEOUT_MS, type ArchiveManifest } from './artifacts'

export type ParseState = 'all' | 'parsed' | 'not_parsed'

/** Snake case on the wire (`GridRowsRequest`). */
export interface GridRowsRequest {
  search: string | null
  industry: string | null
  industries: string[]
  parse_state: ParseState
  filters: FilterCondition[]
  sort: SortSpecification[]
  page: number
  page_size: number
  columns: string[]
}
export interface EventExportRequest extends GridRowsRequest {
  event_ids: string[]
}

export interface ImportSummary {
  events_created: number
  events_skipped: number
  industries_created: number
  types_created: number
  platforms_created: number
  fields_created: number
  files_restored: number
  failures: string[]
}

export const readEventColumns = (industries: string[]) =>
  api<GeneratedGridConfiguration>('/grid/events/columns', { query: { industries } })

export const readEntityColumns = (industry?: string | null, entityType?: string | null) =>
  api<GeneratedGridConfiguration>('/grid/entities/columns', { query: { industry, entity_type: entityType } })

export const readEventRows = (body: GridRowsRequest) => api<GridRowsPage>('/grid/events/rows', { method: 'POST', json: body })

/** `filename*=UTF-8''…` first (RFC 5987), then `filename="…"`. */
export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;]+)/.exec(header)
  const raw = plain?.[1] ?? plain?.[2]?.trim()
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export async function exportEvents(body: EventExportRequest, format: 'csv' | 'json'): Promise<{ blob: Blob; fileName: string }> {
  const res = await send('/exports/events', { method: 'POST', json: body, query: { export_format: format }, timeout: UPLOAD_TIMEOUT_MS })
  const stamp = new Date().toISOString().replace(/\.\d{3}/, '').replace(/[-:]/g, '')
  const fileName = fileNameFromDisposition(res.headers.get('Content-Disposition')) ?? `skyscanner-events-${stamp}.${format}`
  return { blob: await res.blob(), fileName }
}

export const exportEventFiles = (body: EventExportRequest) =>
  api<ArchiveManifest>('/exports/events/files', { method: 'POST', json: body, timeout: UPLOAD_TIMEOUT_MS })

export const exportEventBundle = (body: EventExportRequest) =>
  api<ArchiveManifest>('/exports/events/bundle', { method: 'POST', json: body, timeout: UPLOAD_TIMEOUT_MS })

export function importBundle(file: File): Promise<ImportSummary> {
  const form = new FormData()
  form.append('file', file, file.name)
  return api<ImportSummary>('/imports/events', { method: 'POST', body: form, timeout: UPLOAD_TIMEOUT_MS })
}
