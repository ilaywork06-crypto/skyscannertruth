/**
 * The calls the create wizard and the upload dialog make on events: creating one (with its entities) and
 * attaching freshly uploaded files to an existing one. The rest of the event API lives in ./events.ts.
 */
import { api } from './client'
import type { Artifact } from './storage'
import type { FieldType, JsonValue } from './taxonomy'

export type EventStatus = 'draft' | 'operational'
export type EntityStatus = 'raw' | 'parsing' | 'partially_parsed' | 'parsed' | 'failed'
export type ExperimentResult = 'successful' | 'partial' | 'failed'
export type UploadSource = 'manual' | 'watchdog' | 'automation' | 'script'

export interface MetadataAttribute {
  key: string
  value: JsonValue
  type: FieldType
}

export interface EntityCreateRequest {
  name: string
  entity_type_key: string
  module: string | null
  code_version: string | null
  status: EntityStatus
  notes: string
  upload_source: UploadSource
  requested_at: string | null
  received_at: string | null
  raw_files: Artifact[]
  parsed_files: Artifact[]
  parsed_additional_files: Artifact[]
  metadata: MetadataAttribute[]
}

export interface EventCreateRequest {
  name: string
  event_type_keys: string[]
  industry: string
  platforms: string[]
  status: EventStatus
  experiment_result: ExperimentResult | null
  event_date: string | null
  notes: string
  upload_source: UploadSource
  additional_files: Artifact[]
  metadata: MetadataAttribute[]
  entities: EntityCreateRequest[]
}

/** The part of an event (`GET /events/{id}`) these two flows read. */
export interface CreatedEvent {
  id: string
  event_id: number
  name: string
  industry: string
  additional_files: Artifact[]
  [key: string]: unknown
}

export const createEvent = (request: EventCreateRequest) =>
  api<CreatedEvent>('/events', { method: 'POST', json: request })

export const readEventFiles = (eventId: string) => api<CreatedEvent>(`/events/${encodeURIComponent(eventId)}`)

/** Every edit carries a reason (it joins the edit history); the stored files are kept and the new ones appended. */
export const attachEventFiles = (eventId: string, reason: string, files: Artifact[]) =>
  api<CreatedEvent>(`/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    json: { reason, additional_files: files },
  })

/** `{key: value}` + `{key: type}` → the attribute list, without empty values (null, '', []). */
export function toMetadataAttributes(
  values: Record<string, JsonValue>,
  types: Record<string, FieldType> = {},
): MetadataAttribute[] {
  return Object.entries(values)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([key, value]) => ({ key, value, type: types[key] ?? 'string' }))
}
