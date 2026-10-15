/**
 * The register, read once and held for every page.
 *
 * The listings are read whole and in parallel; every schema is then read whole (its scheme decides the
 * columns); and because a listed assumption carries neither its values nor its industries, every one is read
 * again on its own, six at a time, landing in batches every 150 ms - the table is usable throughout. A forced
 * reload bumps the generation, so readings overtaken by it are dropped.
 */
import { computed, ref, shallowRef } from 'vue'
import {
  readAllAssumptions, readAllIndustries, readAllSchemas, readAssumptionDetails, readLatestAssumption, readLatestSchema,
} from '@/api/endpoints'
import { appliesEverywhere, type AssumptionDetail, type AssumptionRow, type Industry, type SchemaDetail, type SchemaSummary } from '@/models'
import { mergeFields, readScheme, type Scheme, type SchemeField } from '@/lib/scheme'

export interface LoadProgress {
  completed: number
  total: number
}

const LANDING_BATCH_MS = 150

const industries = ref<Industry[]>([])
const schemas = ref<SchemaSummary[]>([])
const assumptions = shallowRef<AssumptionRow[]>([])
const schemaDetails = shallowRef<Map<string, SchemaDetail>>(new Map())
const loading = ref(false)
const completing = ref(false)
const loaded = ref(false)
const progress = ref<LoadProgress>({ completed: 0, total: 0 })
const errorMessage = ref('')
let loadingPromise: Promise<void> | null = null
let generation = 0

async function loadSchemaDetails(summaries: SchemaSummary[]): Promise<void> {
  // All in parallel; built in listing order (not arrival order) so the columns keep a stable order.
  const read = await Promise.all(
    summaries.map(async (s): Promise<[string, SchemaDetail] | null> => {
      try {
        return [s.id, await readLatestSchema(s.id)]
      } catch {
        return null
      }
    }),
  )
  schemaDetails.value = new Map(read.filter((e): e is [string, SchemaDetail] => e !== null))
}

async function completeAssumptions(): Promise<void> {
  const pending = assumptions.value.filter((r) => r.detail === null).map((r) => r.id)
  if (!pending.length) return
  const current = generation
  let landed = new Map<string, AssumptionDetail>()
  let settled = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    timer = null
    const batch = landed
    landed = new Map()
    if (current !== generation) return
    if (batch.size) {
      assumptions.value = assumptions.value.map((row) => {
        const detail = batch.get(row.id)
        return detail === undefined ? row : { ...row, detail }
      })
    }
    progress.value = { ...progress.value, completed: progress.value.completed + settled }
    settled = 0
  }
  const settle = () => {
    settled += 1
    if (timer === null) timer = setTimeout(flush, LANDING_BATCH_MS)
  }
  completing.value = true
  try {
    await readAssumptionDetails(pending, (d) => {
      landed.set(d.id, d)
      settle()
    }, settle)
  } finally {
    if (timer !== null) clearTimeout(timer)
    flush()
    if (current === generation) completing.value = false
  }
}

async function runLoad(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  generation += 1
  try {
    const [inds, schs, listed] = await Promise.all([readAllIndustries(), readAllSchemas(), readAllAssumptions()])
    industries.value = inds
    schemas.value = schs
    assumptions.value = listed.map((s) => ({ ...s, detail: null }))
    progress.value = { completed: 0, total: listed.length }
    loaded.value = true
    await loadSchemaDetails(schs)
  } catch (e) {
    errorMessage.value = e instanceof Error ? e.message : 'The register could not be read'
    throw e
  } finally {
    loading.value = false
  }
  void completeAssumptions()
}

function load(force = false): Promise<void> {
  if (loaded.value && !force) return Promise.resolve()
  if (loadingPromise) return loadingPromise
  loadingPromise = runLoad().finally(() => {
    loadingPromise = null
  })
  return loadingPromise
}

async function readSchemaDetail(id: string): Promise<SchemaDetail> {
  const held = schemaDetails.value.get(id)
  if (held) return held
  const detail = await readLatestSchema(id)
  schemaDetails.value = new Map(schemaDetails.value).set(id, detail)
  return detail
}

async function refreshAssumption(id: string): Promise<AssumptionDetail> {
  const detail = await readLatestAssumption(id)
  assumptions.value = assumptions.value.map((r) => (r.id === id ? { ...r, detail } : r))
  return detail
}

const findIndustry = (identifier: string) => industries.value.find((i) => i.id === identifier || i.name === identifier)
const findAssumption = (id: string) => assumptions.value.find((r) => r.id === id)
const schemeOf = (schemaId: string): Scheme => readScheme(schemaDetails.value.get(schemaId)?.scheme)

/** The schemas an industry fills in: the global ones, the legacy ones naming none, and those naming it. */
function schemasForIndustries(identifiers: string[]): SchemaDetail[] {
  const wanted = new Set(identifiers)
  return [...schemaDetails.value.values()].filter(
    (d) => appliesEverywhere(d) || (d.industries ?? []).some((i) => wanted.has(i.id) || wanted.has(i.name)),
  )
}
const fieldsForIndustries = (identifiers: string[]): SchemeField[] =>
  mergeFields(schemasForIndustries(identifiers).map((d) => readScheme(d.scheme)))

const fields = computed(() => mergeFields([...schemaDetails.value.values()].map((d) => readScheme(d.scheme))))

/** Assumptions per industry name, counted from the readings that have landed. */
const countsByIndustry = computed(() => {
  const counts = new Map<string, number>()
  for (const row of assumptions.value) for (const i of row.detail?.industries ?? []) counts.set(i.name, (counts.get(i.name) ?? 0) + 1)
  return counts
})

export function useRegister() {
  return {
    industries, schemas, assumptions, schemaDetails, loading, completing, loaded, progress, errorMessage, fields,
    countsByIndustry, load, readSchemaDetail, refreshAssumption, findIndustry, findAssumption, schemeOf,
    schemasForIndustries, fieldsForIndustries,
  }
}
