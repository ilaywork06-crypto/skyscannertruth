/**
 * `/assumption` endpoints.
 */

import type { AssumptionDetail, AssumptionDraft, AssumptionSummary } from '@/domain/models'

import { http } from './http'
import { forEachConcurrently, readAll } from './paging'

const PATH = '/assumption'

/**
 * Listed assumptions carry neither values nor industries, so each is read on its own. Six in flight keeps
 * browsers (which cap connections per host) busy without queueing hundreds of sockets.
 */
const DETAIL_CONCURRENCY = 6

const listAssumptions = async (offset: number, limit: number): Promise<AssumptionSummary[]> =>
  (await http.get<AssumptionSummary[]>(PATH, { params: { offset, limit } })).data

const readAllAssumptions = (): Promise<AssumptionSummary[]> => readAll(listAssumptions)

const readLatestAssumption = async (id: string): Promise<AssumptionDetail> =>
  (await http.get<AssumptionDetail>(`${PATH}/${id}/latest`)).data

/** Read many assumptions whole. A failed reading leaves its row as listed and does not stop the rest. */
const readAssumptionDetails = (
  ids: string[],
  onLoaded: (detail: AssumptionDetail) => void,
  onFailed: (id: string) => void,
): Promise<void> =>
  forEachConcurrently(ids, DETAIL_CONCURRENCY, async (id) => {
    try {
      onLoaded(await readLatestAssumption(id))
    } catch {
      onFailed(id)
    }
  })

const createAssumption = async (draft: AssumptionDraft): Promise<string> =>
  (await http.post<{ id: string }>(PATH, draft)).data.id

export const assumptionsApi = {
  list: listAssumptions,
  readAll: readAllAssumptions,
  readLatest: readLatestAssumption,
  readDetails: readAssumptionDetails,
  create: createAssumption,
}
