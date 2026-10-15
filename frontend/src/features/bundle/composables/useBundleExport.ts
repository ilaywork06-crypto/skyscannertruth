/**
 * Exporting an industry's register as a bundle.
 */

import { ref } from 'vue'

import { assumptionsApi } from '@/api'
import { buildBundle, bundleFileName, writeBundle } from '@/domain/bundle'
import { downloadBlob } from '@/shared/utils/download'
import { currentCreator } from '@/shared/utils/identity'
import { useRegisterStore } from '@/stores/register'

const useBundleExport = () => {
  const register = useRegisterStore()
  const exporting = ref(false)

  /**
   * Gather every assumption filed under the industry (reading any not yet read), the schemas they use and
   * every industry they name, then download it.
   */
  const exportIndustry = async (industryId: string): Promise<void> => {
    exporting.value = true
    try {
      const industry = register.findIndustry(industryId)
      const details = await Promise.all(
        register.assumptions.map(async (row) => row.detail ?? (await assumptionsApi.readLatest(row.id))),
      )
      const scoped = details.filter((detail) =>
        detail.industries.some((item) => item.id === industryId || item.name === industryId),
      )
      const usedSchemas = new Set(scoped.flatMap((detail) => detail.schemas.map((schema) => schema.id)))
      const usedIndustries = new Set(scoped.flatMap((detail) => detail.industries.map((item) => item.id)))
      if (industry !== undefined) usedIndustries.add(industry.id)

      const bundle = buildBundle({
        industry: industry?.name ?? industryId,
        industries: register.industries.filter((item) => usedIndustries.has(item.id)),
        schemas: [...register.schemaDetails.values()].filter((schema) => usedSchemas.has(schema.id)),
        assumptions: scoped,
        creator: currentCreator(),
      })

      downloadBlob(new Blob([writeBundle(bundle)], { type: 'application/json' }), bundleFileName(industry?.name ?? null))
    } finally {
      exporting.value = false
    }
  }

  return { exporting, exportIndustry }
}

export { useBundleExport }
