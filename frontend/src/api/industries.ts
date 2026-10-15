/**
 * `/industry` endpoints.
 */

import type { Industry, IndustryDraft } from '@/domain/models'

import { http } from './http'
import { readAll } from './paging'

const PATH = '/industry'

const listIndustries = async (offset: number, limit: number): Promise<Industry[]> =>
  (await http.get<Industry[]>(PATH, { params: { offset, limit } })).data

const readAllIndustries = (): Promise<Industry[]> => readAll(listIndustries)

const readIndustry = async (id: string): Promise<Industry> => (await http.get<Industry>(`${PATH}/${id}`)).data

const createIndustry = async (draft: IndustryDraft): Promise<string> =>
  (await http.post<{ id: string }>(PATH, draft)).data.id

export const industriesApi = { list: listIndustries, readAll: readAllIndustries, read: readIndustry, create: createIndustry }
