/**
 * `/schema` endpoints.
 */

import type { SchemaDetail, SchemaDraft, SchemaRevisionDraft, SchemaSummary } from '@/domain/models'

import { http } from './http'
import { readAll } from './paging'

const PATH = '/schema'

const listSchemas = async (offset: number, limit: number): Promise<SchemaSummary[]> =>
  (await http.get<SchemaSummary[]>(PATH, { params: { offset, limit } })).data

const readAllSchemas = (): Promise<SchemaSummary[]> => readAll(listSchemas)

const readLatestSchema = async (id: string): Promise<SchemaDetail> =>
  (await http.get<SchemaDetail>(`${PATH}/${id}/latest`)).data

const createSchema = async (draft: SchemaDraft): Promise<string> =>
  (await http.post<{ id: string }>(PATH, draft)).data.id

/** A declaration is never edited, only revised. */
const reviseSchema = async (id: string, draft: SchemaRevisionDraft): Promise<string> =>
  (await http.post<{ id: string }>(`${PATH}/${id}/revisions`, draft)).data.id

export const schemasApi = {
  list: listSchemas,
  readAll: readAllSchemas,
  readLatest: readLatestSchema,
  create: createSchema,
  revise: reviseSchema,
}
