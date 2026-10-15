/**
 * The key-rename flow of the settings dialogs: the key is locked while editing until CHANGE is pressed, which
 * runs the dry run (`GET /…/{id}/rename?key=<current>`) and says what a save would rewrite.
 */
import { reportError, translate as t } from '@truth-platform/ui'
import { computed, ref } from 'vue'
import type { RenameResult } from '@/api/taxonomy'

export function renameSummary(result: RenameResult | null): string {
  if (!result) return ''
  const parts = Object.entries(result.affected)
    .filter(([, n]) => n > 0)
    .map(([collection, n]) => `${n} ${t(`rename.collection.${collection}`)}`)
  if (!parts.length) return t('rename.nothing', { key: result.previous_key })
  return t('rename.rewrites', { parts: parts.join(', '), from: result.previous_key })
}

export function useSettingsRename(preview: (id: string, key: string) => Promise<RenameResult>) {
  const unlocked = ref(false)
  const result = ref<RenameResult | null>(null)
  const checking = ref(false)
  const summary = computed(() => renameSummary(result.value))

  const reset = () => {
    unlocked.value = false
    result.value = null
    checking.value = false
  }
  const start = async (id: string, key: string) => {
    unlocked.value = true
    checking.value = true
    try {
      result.value = await preview(id, key)
    } catch (error) {
      reportError(error)
    } finally {
      checking.value = false
    }
  }
  return { unlocked, result, checking, summary, reset, start }
}

/**
 * A form's dirty state: `mark()` remembers the draft as opened, `dirty` compares the current one.
 */
export function useSettingsSnapshot(read: () => unknown) {
  const opened = ref('')
  const mark = () => {
    opened.value = JSON.stringify(read())
  }
  const isDirty = () => JSON.stringify(read()) !== opened.value
  return { mark, isDirty }
}
