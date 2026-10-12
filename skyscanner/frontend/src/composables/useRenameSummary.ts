/**
 * What renaming a key would rewrite, said as a sentence in the language of the page.
 */

import { useLanguage } from '@truth-platform/core-ui'
import { computed, type ComputedRef, type Ref } from 'vue'

import type { RenameResult } from '@/requests/schema'

const useRenameSummary = (preview: Ref<RenameResult | null>): ComputedRef<string> => {
  const { t } = useLanguage()

  return computed<string>(() => {
    const current = preview.value
    if (current === null) {
      return ''
    }

    const counted = Object.entries(current.affected).filter(([, amount]) => amount > 0)
    if (counted.length === 0) {
      return t('rename.nothing', { key: current.previous_key })
    }

    const parts = counted.map(([collection, amount]) => `${amount} ${t(`rename.collection.${collection}`)}`)

    return t('rename.rewrites', { parts: parts.join(', '), from: current.previous_key })
  })
}

export { useRenameSummary }
