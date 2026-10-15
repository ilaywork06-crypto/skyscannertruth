/**
 * Saved views. Shared ones live on the service (`/templates`); private ones in this browser under
 * `skyscanner.templates.private` (ids `local:<uuid>`, owner `me`) - the same keys and shapes as the original
 * client, so views saved before the rewrite are still there. The view last applied is remembered per scope and
 * single industry in `skyscanner.templates.active`.
 */
import type { FilterCondition, SortSpecification } from '@truth-platform/grid'
import { newLocalId, storage } from '@truth-platform/ui'
import { api } from './client'

export interface TemplateColumn {
  key: string
  visible: boolean
  order: number
  width: number | null
  pinned: string | null
}

export interface TableTemplate {
  id: string
  name: string
  description: string
  scope: string
  industry: string | null
  owner: string
  shared: boolean
  columns: TemplateColumn[]
  filters: FilterCondition[]
  sort: SortSpecification[]
  created_at: string
  updated_at: string | null
}

export type TemplateCreateRequest = Omit<TableTemplate, 'id' | 'owner' | 'created_at' | 'updated_at'>

export const PRIVATE_KEY = 'skyscanner.templates.private'
export const ACTIVE_KEY = 'skyscanner.templates.active'
const LOCAL_PREFIX = 'local:'

export const isLocalTemplate = (id: string) => id.startsWith(LOCAL_PREFIX)

function readLocal(): TableTemplate[] {
  const list = storage.json<unknown>(PRIVATE_KEY, [])
  return Array.isArray(list) ? (list as TableTemplate[]) : []
}
function writeLocal(list: TableTemplate[]): void {
  storage.setJson(PRIVATE_KEY, list)
}

export function listLocalTemplates(scope: string, industry: string | null): TableTemplate[] {
  return readLocal()
    .filter((t) => t.scope === scope && (t.industry === null || t.industry === industry))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function createLocalTemplate(req: TemplateCreateRequest): TableTemplate {
  const created: TableTemplate = { ...req, id: LOCAL_PREFIX + newLocalId(), owner: 'me', created_at: new Date().toISOString(), updated_at: null }
  writeLocal([...readLocal().filter((t) => !(t.scope === req.scope && t.name === req.name)), created])
  return created
}

/** Shared views from the service, then this browser's private ones. */
export async function listTemplates(scope: string, industry: string | null): Promise<TableTemplate[]> {
  const remote = await api<TableTemplate[]>('/templates', { query: { scope, industry } })
  return [...remote.filter((t) => t.shared), ...listLocalTemplates(scope, industry)]
}

export async function createTemplate(req: TemplateCreateRequest): Promise<TableTemplate> {
  if (!req.shared) return createLocalTemplate(req)
  return api<TableTemplate>('/templates', { method: 'POST', json: req })
}

export async function deleteTemplate(id: string): Promise<void> {
  if (isLocalTemplate(id)) {
    writeLocal(readLocal().filter((t) => t.id !== id))
    return
  }
  await api(`/templates/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* ------------------------------------------------------------------ the view last applied */

const activeKey = (scope: string, industry: string | null) => `${scope}:${industry ?? ''}`

function readActiveMap(): Record<string, string> {
  const map = storage.json<unknown>(ACTIVE_KEY, {})
  return map && typeof map === 'object' && !Array.isArray(map) ? (map as Record<string, string>) : {}
}

export function readActiveTemplate(scope: string, industry: string | null): string | null {
  return readActiveMap()[activeKey(scope, industry)] ?? null
}

export function writeActiveTemplate(scope: string, industry: string | null, id: string | null): void {
  const map = readActiveMap()
  if (id === null) delete map[activeKey(scope, industry)]
  else map[activeKey(scope, industry)] = id
  storage.setJson(ACTIVE_KEY, map)
}
