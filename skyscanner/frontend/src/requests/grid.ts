/**
 * Every call that fetches a generated table - its column definitions, its blocks of rows and its filter options.
 */

import type { GeneratedGridConfiguration, GridRowsPage } from '@/models/grid'
import type { GridRowsRequest } from '@/models/query'
import { client } from '@/requests/client'

/**
 * Read the configuration of the inventory table for every industry, for one, or for several of them.
 */
const readEventColumns = async (industries: string | string[] | null): Promise<GeneratedGridConfiguration> => {
  const picked = industries === null ? [] : Array.isArray(industries) ? industries : [industries]
  const params = new URLSearchParams()
  picked.forEach((industry) => params.append('industries', industry))

  const response = await client.get<GeneratedGridConfiguration>('/grid/events/columns', { params })

  return response.data
}

/**
 * Read the configuration of the table that renders the entities of one event.
 */
const readEntityColumns = async (
  industry: string | null,
  entityType: string | null,
): Promise<GeneratedGridConfiguration> => {
  const response = await client.get<GeneratedGridConfiguration>('/grid/entities/columns', {
    params: { industry: industry ?? undefined, entity_type: entityType ?? undefined },
  })

  return response.data
}

/**
 * Read one block of inventory rows, already flattened into the shape the column definitions address.
 */
const readEventRows = async (request: GridRowsRequest): Promise<GridRowsPage> => {
  const response = await client.post<GridRowsPage>('/grid/events/rows', request)

  return response.data
}

export { readEntityColumns, readEventColumns, readEventRows }
