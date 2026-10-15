/** Events, their entities and their edit history (spec §5, §10.1). */
import type { GridRow } from '@truth-platform/grid'
import { api } from './client'
import type { Artifact } from './artifacts'
import type { FieldType, JsonValue, OperationResult } from './taxonomy'

export type EventStatus = 'draft' | 'operational'
export type EntityStatus = 'raw' | 'parsing' | 'partially_parsed' | 'parsed' | 'failed'
export type ExperimentResult = 'successful' | 'partial' | 'failed'
export type UploadSource = 'manual' | 'watchdog' | 'automation' | 'script'

export const ENTITY_STATUSES: EntityStatus[] = ['raw', 'parsing', 'partially_parsed', 'parsed', 'failed']
export const EXPERIMENT_RESULTS: ExperimentResult[] = ['successful', 'partial', 'failed']
export const BRIEF_MAX_LENGTH = 50

export interface MetadataAttribute {
  key: string
  value: JsonValue
  type: FieldType
}
export interface ObjectTypeReference {
  id: string
  name: string
}

export interface EventSummary {
  id: string
  event_id: number
  name: string
  event_type: ObjectTypeReference[]
  industry: string
  platforms: string[]
  status: EventStatus
  experiment_result: ExperimentResult | null
  event_date: string | null
  created_at: string
  updated_at: string | null
  notes: string
  additional_files: Artifact[]
  metadata: MetadataAttribute[]
  entity_counts: Record<string, number>
  created_by: string | null
  updated_by: string | null
}

export interface EntityResponse {
  id: string
  object_id: number
  name: string
  event_id: string
  object_type: ObjectTypeReference
  object_type_key: string
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
  created_at: string
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
}

export interface EventDetail extends EventSummary {
  objects: EntityResponse[]
  upload_source: UploadSource
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

export interface EventUpdateRequest {
  reason: string
  name?: string
  event_type_keys?: string[]
  industry?: string
  platforms?: string[]
  status?: EventStatus
  experiment_result?: ExperimentResult | null
  event_date?: string | null
  notes?: string
  additional_files?: Artifact[]
  metadata?: MetadataAttribute[]
}

export interface EntityUpdateRequest {
  reason: string
  name?: string
  module?: string | null
  code_version?: string | null
  status?: EntityStatus
  notes?: string
  requested_at?: string | null
  received_at?: string | null
  raw_files?: Artifact[]
  parsed_files?: Artifact[]
  parsed_additional_files?: Artifact[]
  metadata?: MetadataAttribute[]
}

export interface FieldChange {
  key: string
  label: string
  before: JsonValue
  after: JsonValue
}
export interface Revision {
  id: string
  target: 'event' | 'entity'
  event_id: string
  entity_id: string | null
  entity_name: string
  version: number
  reason: string
  changed_by: string
  changed_at: string
  changes: FieldChange[]
}

/* ------------------------------------------------------------------ events */

export const readEvent = (id: string) => api<EventDetail>(`/events/${encodeURIComponent(id)}`)
export const createEvent = (body: EventCreateRequest) => api<EventDetail>('/events', { method: 'POST', json: body })
export const updateEvent = (id: string, body: EventUpdateRequest) =>
  api<EventDetail>(`/events/${encodeURIComponent(id)}`, { method: 'PATCH', json: body })
export const deleteEvent = (id: string) => api<OperationResult>(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' })

/* ------------------------------------------------------------------ entities */

export const listEntities = (eventId: string, entityType?: string | null) =>
  api<EntityResponse[]>(`/events/${encodeURIComponent(eventId)}/entities`, { query: { entity_type: entityType } })
export const createEntity = (eventId: string, body: EntityCreateRequest) =>
  api<EntityResponse>(`/events/${encodeURIComponent(eventId)}/entities`, { method: 'POST', json: body })
export const updateEntity = (eventId: string, entityId: string, body: EntityUpdateRequest) =>
  api<EntityResponse>(`/events/${encodeURIComponent(eventId)}/entities/${encodeURIComponent(entityId)}`, { method: 'PATCH', json: body })
export const deleteEntity = (eventId: string, entityId: string) =>
  api<OperationResult>(`/events/${encodeURIComponent(eventId)}/entities/${encodeURIComponent(entityId)}`, { method: 'DELETE' })

/* ------------------------------------------------------------------ history */

export const listEventRevisions = (eventId: string, includeEntities = true) =>
  api<Revision[]>(`/events/${encodeURIComponent(eventId)}/revisions`, { query: { include_entities: includeEntities } })
export const listEntityRevisions = (eventId: string, entityId: string) =>
  api<Revision[]>(`/events/${encodeURIComponent(eventId)}/entities/${encodeURIComponent(entityId)}/revisions`)

/* ------------------------------------------------------------------ rows */

/** The metadata list as a key → value map. */
export function metadataValues(metadata: MetadataAttribute[] | null | undefined): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {}
  for (const m of metadata ?? []) out[m.key] = m.value
  return out
}
export function metadataTypes(metadata: MetadataAttribute[] | null | undefined): Record<string, FieldType> {
  const out: Record<string, FieldType> = {}
  for (const m of metadata ?? []) out[m.key] = m.type
  return out
}

/** Filled values back into the stored list: null, '' and empty lists are dropped. */
export function toMetadataAttributes(values: Record<string, JsonValue | undefined>, types: Record<string, FieldType>): MetadataAttribute[] {
  const out: MetadataAttribute[] = []
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) continue
    out.push({ key, value, type: types[key] ?? 'string' })
  }
  return out
}

/** An event as a grid row (the way the inventory's rows are flattened by the service). */
export function eventToRow(event: EventSummary): GridRow {
  return {
    ...(event as unknown as GridRow),
    id: event.id,
    event_type_names: event.event_type.map((t) => t.name).join(', '),
    data: metadataValues(event.metadata),
  } as GridRow
}

export function entityToRow(entity: EntityResponse): GridRow {
  const parsedAll = [...entity.parsed_files, ...entity.parsed_additional_files]
  return {
    ...(entity as unknown as GridRow),
    id: entity.id,
    object_type_name: entity.object_type?.name ?? '',
    object_type_key: entity.object_type_key,
    parsed_all_files: parsedAll as unknown as GridRow[string],
    files: [...entity.raw_files, ...parsedAll] as unknown as GridRow[string],
    data: metadataValues(entity.metadata),
  } as GridRow
}
