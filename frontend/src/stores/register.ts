/**
 * The register: every industry, schema and assumption, read once and shared by every page.
 *
 * The API answers one window of one collection at a time and cannot search, so the client holds the whole
 * register. Reading happens in two stages because listed assumptions carry neither values nor industries:
 *   1. industries, schemas (with their declarations) and the assumption listing arrive - pages can render;
 *   2. every assumption is read on its own in the background and rows gain values and industries.
 */

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import { assumptionsApi, industriesApi, schemasApi } from '@/api'
import type { AssumptionDetail, AssumptionRecord, Industry, SchemaDetail, SchemaSummary } from '@/domain/models'
import { schemaAppliesTo } from '@/domain/models'
import type { SchemeField } from '@/domain/scheme'
import { mergeFields, readScheme } from '@/domain/scheme'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

/** Readings that land within this window are applied in one replacement of the rows. */
const LANDING_BATCH_MS = 150

export const useRegisterStore = defineStore('register', () => {
  const industries = ref<Industry[]>([])
  const schemas = ref<SchemaSummary[]>([])
  const schemaDetails = shallowRef<Map<string, SchemaDetail>>(new Map())
  const assumptions = shallowRef<AssumptionRecord[]>([])

  const state = ref<LoadState>('idle')
  const error = ref<unknown>(null)
  const completing = ref(false)
  const progress = ref({ done: 0, total: 0 })

  /** Which load is current; a load overtaken by a newer one stops writing. */
  let generation = 0
  let pending: Promise<void> | null = null

  /* ---------- reading ---------- */

  const readSchemaDetails = async (summaries: SchemaSummary[]): Promise<Map<string, SchemaDetail>> => {
    const read = await Promise.all(
      summaries.map(async (summary) => {
        try {
          return [summary.id, await schemasApi.readLatest(summary.id)] as const
        } catch {
          /* An unreadable declaration costs only its own columns. */
          return null
        }
      }),
    )

    /* Stored in listing order (not arrival order) so the columns are stable between loads. */
    return new Map(read.filter((entry): entry is readonly [string, SchemaDetail] => entry !== null))
  }

  const completeAssumptions = async (current: number): Promise<void> => {
    const ids = assumptions.value.filter((row) => row.detail === null).map((row) => row.id)
    if (ids.length === 0) {
      return
    }

    let landed = new Map<string, AssumptionDetail>()
    let settled = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const flush = () => {
      timer = null
      const batch = landed
      landed = new Map()
      if (current !== generation) {
        return
      }
      if (batch.size > 0) {
        assumptions.value = assumptions.value.map((row) => {
          const detail = batch.get(row.id)

          return detail === undefined ? row : { ...row, detail }
        })
      }
      progress.value = { ...progress.value, done: progress.value.done + settled }
      settled = 0
    }

    const settle = () => {
      settled += 1
      timer ??= setTimeout(flush, LANDING_BATCH_MS)
    }

    completing.value = true
    try {
      await assumptionsApi.readDetails(
        ids,
        (detail) => {
          landed.set(detail.id, detail)
          settle()
        },
        settle,
      )
    } finally {
      if (timer !== null) clearTimeout(timer)
      flush()
      if (current === generation) completing.value = false
    }
  }

  const runLoad = async (): Promise<void> => {
    generation += 1
    const current = generation
    state.value = 'loading'
    error.value = null

    try {
      const [readIndustries, readSchemas, listed] = await Promise.all([
        industriesApi.readAll(),
        schemasApi.readAll(),
        assumptionsApi.readAll(),
      ])
      const details = await readSchemaDetails(readSchemas)
      if (current !== generation) {
        return
      }

      industries.value = readIndustries
      schemas.value = readSchemas
      schemaDetails.value = details
      assumptions.value = listed.map((summary) => ({ ...summary, detail: null }))
      progress.value = { done: 0, total: listed.length }
      state.value = 'ready'
    } catch (caught) {
      if (current === generation) {
        error.value = caught
        state.value = 'error'
      }
      throw caught
    }

    void completeAssumptions(current)
  }

  /** Load the register once; concurrent callers share the same load. `force` reads it again. */
  const load = (force = false): Promise<void> => {
    if (state.value === 'ready' && !force) {
      return Promise.resolve()
    }
    pending ??= runLoad().finally(() => {
      pending = null
    })

    return pending
  }

  /* ---------- targeted refreshes after writes ---------- */

  const refreshIndustries = async (): Promise<void> => {
    industries.value = await industriesApi.readAll()
  }

  const refreshSchema = async (schemaId: string): Promise<SchemaDetail> => {
    const [detail, summaries] = await Promise.all([schemasApi.readLatest(schemaId), schemasApi.readAll()])
    schemas.value = summaries
    const next = new Map(schemaDetails.value)
    next.set(schemaId, detail)
    schemaDetails.value = next

    return detail
  }

  /** Read one assumption again (or for the first time) and put it at the top of the register. */
  const refreshAssumption = async (assumptionId: string): Promise<AssumptionDetail> => {
    const detail = await assumptionsApi.readLatest(assumptionId)
    const known = assumptions.value.some((row) => row.id === assumptionId)
    const record: AssumptionRecord = { ...detail, schemas: detail.schemas, detail }
    assumptions.value = known
      ? assumptions.value.map((row) => (row.id === assumptionId ? { ...row, detail } : row))
      : [record, ...assumptions.value]

    return detail
  }

  const readSchemaDetail = async (schemaId: string): Promise<SchemaDetail> =>
    schemaDetails.value.get(schemaId) ?? refreshSchema(schemaId)

  /* ---------- lookups ---------- */

  const findIndustry = (identifier: string): Industry | undefined =>
    industries.value.find((industry) => industry.id === identifier || industry.name === identifier)

  const findAssumption = (assumptionId: string): AssumptionRecord | undefined =>
    assumptions.value.find((row) => row.id === assumptionId)

  const schemasFor = (identifiers: string[]): SchemaDetail[] =>
    [...schemaDetails.value.values()].filter((schema) => schemaAppliesTo(schema, identifiers))

  /** The attributes declared for the given industries, one per key. */
  const fieldsFor = (identifiers: string[]): SchemeField[] =>
    mergeFields(schemasFor(identifiers).map((schema) => readScheme(schema.scheme)))

  /* ---------- aggregates ---------- */

  /** Assumption count per industry id, over the readings that have landed. */
  const countsByIndustry = computed<Map<string, number>>(() => {
    const counts = new Map<string, number>()
    for (const row of assumptions.value) {
      row.detail?.industries.forEach((industry) => counts.set(industry.id, (counts.get(industry.id) ?? 0) + 1))
    }

    return counts
  })

  /** Assumption count per schema id. */
  const countsBySchema = computed<Map<string, number>>(() => {
    const counts = new Map<string, number>()
    for (const row of assumptions.value) {
      row.schemas.forEach((schema) => counts.set(schema.id, (counts.get(schema.id) ?? 0) + 1))
    }

    return counts
  })

  const isReady = computed(() => state.value === 'ready')

  return {
    industries,
    schemas,
    schemaDetails,
    assumptions,
    state,
    error,
    completing,
    progress,
    isReady,
    countsByIndustry,
    countsBySchema,
    load,
    refreshIndustries,
    refreshSchema,
    refreshAssumption,
    readSchemaDetail,
    findIndustry,
    findAssumption,
    schemasFor,
    fieldsFor,
  }
})
