/**
 * Restoring a bundle: industries, then schemas, then assumptions - each pass naming what the one before
 * created, with the register re-read in between so names resolve to ids.
 */

import { computed, ref, shallowRef } from 'vue'

import { assumptionsApi, industriesApi, schemasApi } from '@/api'
import type { Bundle, RestorePlan } from '@/domain/bundle'
import { assumptionDraft, nameResolver, planRestore, readBundle } from '@/domain/bundle'
import { t } from '@/i18n'
import { errorMessage } from '@/shared/utils/errors'
import { currentCreator } from '@/shared/utils/identity'
import { useRegisterStore } from '@/stores/register'

const useBundleRestore = () => {
  const register = useRegisterStore()

  const bundle = shallowRef<Bundle | null>(null)
  const fileName = ref('')
  const unreadable = ref(false)
  const running = ref(false)
  const finished = ref(false)
  const done = ref(0)
  const created = ref(0)
  const total = ref(0)
  const failures = ref<string[]>([])

  /* Frozen when a restore starts, so the summary keeps describing what was restored rather than what is left. */
  const started = shallowRef<RestorePlan | null>(null)

  const live = computed(() =>
    planRestore(bundle.value, {
      industries: register.industries.map((item) => item.name),
      schemas: register.schemas.map((item) => item.name),
      assumptions: register.assumptions.map((row) => ({ name: row.name, text: row.assumption_text })),
    }),
  )

  const plan = computed(() => started.value ?? live.value)

  const progress = computed(() => (total.value === 0 ? 0 : (done.value / total.value) * 100))

  const reset = () => {
    bundle.value = null
    started.value = null
    fileName.value = ''
    unreadable.value = false
    running.value = false
    finished.value = false
    done.value = 0
    created.value = 0
    total.value = 0
    failures.value = []
  }

  const pick = async (file: File | null) => {
    reset()
    if (file === null) return
    fileName.value = file.name
    bundle.value = readBundle(await file.text())
    unreadable.value = bundle.value === null
  }

  const attempt = async (label: string, write: () => Promise<unknown>) => {
    try {
      await write()
      created.value += 1
    } catch (error) {
      failures.value = [...failures.value, `${label} — ${errorMessage(error)}`]
    } finally {
      done.value += 1
    }
  }

  /** Run the restore. One failed write does not stop the others; every failure is listed. */
  const restore = async (): Promise<void> => {
    const wanted = live.value
    started.value = wanted
    const creator = currentCreator()
    running.value = true
    finished.value = false
    done.value = 0
    created.value = 0
    total.value = wanted.total
    failures.value = []

    try {
      for (const industry of wanted.industries) {
        await attempt(industry.name, () =>
          industriesApi.create({ name: industry.name, description: industry.description, creator: industry.creator || creator }),
        )
      }
      if (wanted.industries.length > 0) await register.refreshIndustries()

      const resolveIndustry = nameResolver(register.industries)
      const takenFrom = bundle.value?.industry ?? null

      for (const schema of wanted.schemas) {
        /* An older, "global" schema is filed under the industry the bundle was taken from. */
        const named = schema.industries.length > 0 ? schema.industries : takenFrom === null ? [] : [takenFrom]
        await attempt(schema.name, async () => {
          if (named.length === 0) throw new Error(t('import.schemaNoIndustry'))

          return schemasApi.create({
            name: schema.name,
            description: schema.description,
            type: schema.type,
            scheme: schema.scheme,
            creator: schema.creator || creator,
            industries: named.map(resolveIndustry),
          })
        })
      }
      if (wanted.schemas.length > 0) await register.load(true)

      const resolve = { schema: nameResolver(register.schemas), industry: resolveIndustry }
      for (const assumption of wanted.assumptions) {
        await attempt(assumption.name, () => assumptionsApi.create(assumptionDraft(assumption, creator, resolve)))
      }
    } finally {
      running.value = false
      finished.value = true
    }

    if (created.value > 0) await register.load(true)
  }

  return { bundle, fileName, unreadable, plan, running, finished, done, created, total, failures, progress, reset, pick, restore }
}

export { useBundleRestore }
