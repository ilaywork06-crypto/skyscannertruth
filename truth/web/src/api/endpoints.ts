/** Every endpoint of the assumptions API, and only those. Names in paths are percent-encoded. */
import type {
  AssumptionDetail, AssumptionDraft, AssumptionSummary, Industry, IndustryDraft, SchemaDetail, SchemaDraft,
  SchemaRevisionDraft, SchemaSummary,
} from '@/models'
import { http } from './client'
import { readAll } from './paging'

interface Created {
  id: string
}

// Industries
export const listIndustries = (offset: number, limit: number) => http.get<Industry[]>('/industry', { offset, limit })
export const readAllIndustries = (onProgress?: (n: number) => void) => readAll(listIndustries, onProgress)
export const readIndustry = (id: string) => http.get<Industry>(`/industry/${id}`)
export const readIndustryByName = (name: string) => http.get<Industry>(`/industry/name/${encodeURIComponent(name)}`)
export const createIndustry = async (draft: IndustryDraft) => (await http.post<Created>('/industry', draft)).id

// Schemas
export const listSchemas = (offset: number, limit: number) => http.get<SchemaSummary[]>('/schema', { offset, limit })
export const readAllSchemas = (onProgress?: (n: number) => void) => readAll(listSchemas, onProgress)
export const readSchema = (id: string) => http.get<SchemaDetail>(`/schema/${id}`)
export const readLatestSchema = (id: string) => http.get<SchemaDetail>(`/schema/${id}/latest`)
export const readSchemaByName = (name: string) => http.get<SchemaDetail>(`/schema/name/${encodeURIComponent(name)}`)
export const createSchema = async (draft: SchemaDraft) => (await http.post<Created>('/schema', draft)).id
export const createSchemaRevision = async (id: string, draft: SchemaRevisionDraft) =>
  (await http.post<Created>(`/schema/${id}/revisions`, draft)).id
export const createSchemaRevisionByName = async (name: string, draft: SchemaRevisionDraft) =>
  (await http.post<Created>(`/schema/name/${encodeURIComponent(name)}/revisions`, draft)).id

// Assumptions
/** How many assumption readings are in the air at once while the listing is being completed. */
export const DETAIL_CONCURRENCY = 6
export const listAssumptions = (offset: number, limit: number) => http.get<AssumptionSummary[]>('/assumption', { offset, limit })
export const readAllAssumptions = (onProgress?: (n: number) => void) => readAll(listAssumptions, onProgress)
export const readAssumption = (id: string) => http.get<AssumptionDetail>(`/assumption/${id}`)
export const readLatestAssumption = (id: string) => http.get<AssumptionDetail>(`/assumption/${id}/latest`)
export const createAssumption = async (draft: AssumptionDraft) => (await http.post<Created>('/assumption', draft)).id

/**
 * Read many assumptions, `DETAIL_CONCURRENCY` at a time over a shared index. One failed reading does not stop
 * the rest; it is reported and its row stays as listed.
 */
export async function readAssumptionDetails(
  ids: string[],
  onLoaded: (detail: AssumptionDetail) => void,
  onFailed?: (id: string, error: Error) => void,
): Promise<void> {
  let next = 0
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next]
      next += 1
      try {
        onLoaded(await readLatestAssumption(id))
      } catch (e) {
        onFailed?.(id, e instanceof Error ? e : new Error('The assumption could not be read'))
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DETAIL_CONCURRENCY, ids.length) }, () => worker()))
}
