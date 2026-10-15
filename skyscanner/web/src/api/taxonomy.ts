/**
 * The declarations the inventory is built from: industries, platforms, event and entity types, and the declared
 * fields. Reads and writes, exactly the original contract (§9 / §10.1 of the client spec). The settings pages and
 * the inventory both import from here - the exported names are stable.
 *
 * Server state is cached with @tanstack/vue-query under `TAXONOMY_KEYS`; whoever writes invalidates the
 * matching key (`invalidateTaxonomy`) so tabs, filters and forms catch up.
 */
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { api } from './client'

/* ------------------------------------------------------------------ shapes */

export type FieldType =
  | 'string' | 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | 'enum' | 'file' | 'json' | 'coordinate'
export type FieldScope = 'event' | 'entity'
export type OptionalEventField = 'event_date' | 'experiment_result' | 'notes'
export type DependencyOperator = 'has_value' | 'is_empty' | 'equals' | 'one_of' | 'not_equals'
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface Industry {
  id: string
  key: string
  name: string
  name_he: string
  description: string
  /** An mdi icon name (`mdi-airplane`); drawn through `industryIcon()` in lib/icons. */
  icon: string
  /** Legacy, never shown. */
  color?: string
  modules: string[]
  event_count: number
  created_at: string
}
export interface IndustryDraft {
  key: string
  name: string
  name_he: string
  description: string
  icon: string
  modules: string[]
}
export type IndustryEdit = Partial<Omit<IndustryDraft, 'key'>>

export interface Platform {
  id: string
  key: string
  name: string
  name_he: string
  description: string
  industries: string[]
}
export interface PlatformDraft {
  key: string
  name: string
  name_he: string
  description: string
  industries: string[]
  order?: number
}
export type PlatformEdit = Partial<PlatformDraft>

export interface EventType {
  id: string
  key: string
  name: string
  name_he: string
  description: string
  /** Empty = offered in every industry. */
  industries: string[]
  fields: OptionalEventField[]
  custom_fields: string[]
}
export interface EventTypeDraft {
  key: string
  name: string
  name_he: string
  description: string
  industries: string[]
  order?: number
  fields: OptionalEventField[]
  custom_fields: string[]
}
export type EventTypeEdit = Partial<EventTypeDraft>

export interface EntityType {
  id: string
  key: string
  name: string
  name_he: string
  description: string
  icon: string | null
  industries: string[]
}
export interface EntityTypeDraft {
  key: string
  name: string
  name_he: string
  description: string
  industries: string[]
  order?: number
  icon: string | null
}
export type EntityTypeEdit = Partial<EntityTypeDraft>

export interface FieldMetadata {
  allowed_file_types: string[]
  name_he: string | null
  options: string[]
  unit: string | null
  description: string | null
  placeholder: string | null
  group: string | null
}
export interface FieldConstraint {
  name: string
  value: JsonValue
  message: string | null
}
export interface FieldDependency {
  field: string
  operator: DependencyOperator
  values: JsonValue[]
}
export interface FieldDefinition {
  id: string
  name: string
  key: string
  type: FieldType
  array: boolean
  default: JsonValue
  required: boolean
  scope: FieldScope
  industry: string | null
  entity_type: string | null
  additional: boolean
  metadata: FieldMetadata
  constraints: FieldConstraint[]
  depends_on: FieldDependency[]
  filterable: boolean
  sortable: boolean
  editable: boolean
  visible: boolean
  order: number
  discovered: boolean
  created_at: string
  updated_at: string | null
  created_by: string | null
}
export type FieldDraft = Omit<FieldDefinition, 'id' | 'discovered' | 'created_at' | 'updated_at' | 'created_by'>
export type FieldEdit = Partial<Omit<FieldDraft, 'scope' | 'industry' | 'entity_type'>>

export interface FieldQuery {
  scope: FieldScope
  industry?: string | null
  entity_type?: string | null
  /** Shared (industry-less) declarations too. Default true, as the original client always asked. */
  include_shared?: boolean
  /** Only the "Additional data" block (true) or only the own fields (false); omitted = both. */
  additional?: boolean | null
}

/** Answer of the rename dry run and of a renaming save. */
export interface RenameResult {
  key: string
  previous_key: string
  affected: Record<string, number>
}

export interface OperationResult {
  success: boolean
  message: string
  affected: number
}

/* ------------------------------------------------------------------ industries */

export const listIndustries = () => api<Industry[]>('/industries')
export const readIndustry = (key: string) => api<Industry>(`/industries/${encodeURIComponent(key)}`)
export const createIndustry = (draft: IndustryDraft) => api<Industry>('/industries', { method: 'POST', json: draft })
export const updateIndustry = (key: string, edit: IndustryEdit) =>
  api<Industry>(`/industries/${encodeURIComponent(key)}`, { method: 'PATCH', json: edit })

/* ------------------------------------------------------------------ platforms */

export const listPlatforms = (industry?: string | null) => api<Platform[]>('/platforms', { query: { industry } })
export const createPlatform = (draft: PlatformDraft) => api<Platform>('/platforms', { method: 'POST', json: { order: 100, ...draft } })
export const updatePlatform = (id: string, edit: PlatformEdit) =>
  api<Platform>(`/platforms/${encodeURIComponent(id)}`, { method: 'PATCH', json: edit })
export const deletePlatform = (id: string) => api<OperationResult>(`/platforms/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const previewPlatformRename = (id: string, key: string) =>
  api<RenameResult>(`/platforms/${encodeURIComponent(id)}/rename`, { query: { key } })

/* ------------------------------------------------------------------ types */

export const listEventTypes = (industry?: string | null) => api<EventType[]>('/types/events', { query: { industry } })
export const listEntityTypes = (industry?: string | null) => api<EntityType[]>('/types/entities', { query: { industry } })
export const createEventType = (draft: EventTypeDraft) =>
  api<EventType>('/types/events', { method: 'POST', json: { order: 100, ...draft } })
export const createEntityType = (draft: EntityTypeDraft) =>
  api<EntityType>('/types/entities', { method: 'POST', json: { order: 100, ...draft } })
export const updateEventType = (id: string, edit: EventTypeEdit) =>
  api<EventType>(`/types/events/${encodeURIComponent(id)}`, { method: 'PATCH', json: edit })
export const updateEntityType = (id: string, edit: EntityTypeEdit) =>
  api<EntityType>(`/types/entities/${encodeURIComponent(id)}`, { method: 'PATCH', json: edit })
/** Either kind - the service finds the declaration by id. */
export const deleteType = (id: string) => api<OperationResult>(`/types/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const previewTypeRename = (id: string, key: string) =>
  api<RenameResult>(`/types/${encodeURIComponent(id)}/rename`, { query: { key } })

/* ------------------------------------------------------------------ fields */

export const listFields = (q: FieldQuery) =>
  api<FieldDefinition[]>('/fields', {
    query: {
      scope: q.scope,
      industry: q.industry ?? undefined,
      entity_type: q.entity_type ?? undefined,
      include_shared: q.include_shared ?? true,
      additional: q.additional === null || q.additional === undefined ? undefined : q.additional,
    },
  })
export const createField = (draft: FieldDraft) => api<FieldDefinition>('/fields', { method: 'POST', json: draft })
export const updateField = (id: string, edit: FieldEdit) =>
  api<FieldDefinition>(`/fields/${encodeURIComponent(id)}`, { method: 'PATCH', json: edit })
export const deleteField = (id: string) => api<OperationResult>(`/fields/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const previewFieldRename = (id: string, key: string) =>
  api<RenameResult>(`/fields/${encodeURIComponent(id)}/rename`, { query: { key } })

/* ------------------------------------------------------------------ cache */

export const TAXONOMY_KEYS = {
  all: ['taxonomy'] as const,
  industries: ['taxonomy', 'industries'] as const,
  platforms: (industry?: string | null) => ['taxonomy', 'platforms', industry ?? null] as const,
  eventTypes: (industry?: string | null) => ['taxonomy', 'event-types', industry ?? null] as const,
  entityTypes: (industry?: string | null) => ['taxonomy', 'entity-types', industry ?? null] as const,
  fields: (q: FieldQuery) =>
    ['taxonomy', 'fields', q.scope, q.industry ?? null, q.entity_type ?? null, q.include_shared ?? true, q.additional ?? null] as const,
}

/** After any write: every cached declaration is re-read (tabs, filters and forms catch up). */
export function invalidateTaxonomy(client: QueryClient): Promise<void> {
  return client.invalidateQueries({ queryKey: TAXONOMY_KEYS.all })
}

/**
 * The industries, cached once for the whole page (the original's module-level singleton). `refresh()` forces a
 * re-read - the industries page and every industry edit call it.
 */
export function useIndustries() {
  const client = useQueryClient()
  const query = useQuery({ queryKey: TAXONOMY_KEYS.industries, queryFn: listIndustries, staleTime: 5 * 60_000 })
  return {
    industries: computed<Industry[]>(() => query.data.value ?? []),
    loaded: computed(() => query.isSuccess.value),
    loading: computed(() => query.isLoading.value),
    error: computed(() => query.error.value),
    refresh: () => client.invalidateQueries({ queryKey: TAXONOMY_KEYS.industries }),
    find: (key: string | null | undefined) => (key ? (query.data.value ?? []).find((i) => i.key === key) : undefined),
  }
}

/** Platforms serving an industry: those bound to none (every industry) or to it. */
export function servesIndustry(item: { industries: string[] }, industry: string | null | undefined): boolean {
  return !industry || !item.industries.length || item.industries.includes(industry)
}
