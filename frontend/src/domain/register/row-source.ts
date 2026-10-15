/**
 * Where the register table reads its pages from.
 *
 * Today the API cannot search, filter or sort, so the source answers from rows held in memory. When the
 * service learns to, a source that forwards the same `RegisterQuery` replaces `createMemoryRowSource` and
 * nothing else changes - including every link already shared, since the query is what the address holds.
 */

import { collectOptions, runQuery } from './query'
import type { RegisterPage, RegisterQuery, RegisterRow } from './types'

interface RowSource {
  readPage: (query: RegisterQuery) => Promise<RegisterPage>
  readOptions: (columnId: string) => Promise<string[]>
}

const createMemoryRowSource = (rows: () => RegisterRow[]): RowSource => ({
  readPage: (query) => Promise.resolve(runQuery(rows(), query)),
  readOptions: (columnId) => Promise.resolve(collectOptions(rows(), columnId)),
})

export type { RowSource }
export { createMemoryRowSource }
