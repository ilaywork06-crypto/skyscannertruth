/**
 * The composable behind the single notification bar of the application, shared by every page and dialog.
 */

import { ref, type Ref } from 'vue'

import { isolate } from '../utils/bidi'
import { language, translate } from './useLanguage'

type SnackbarTone = 'success' | 'error' | 'info' | 'warning'

interface SnackbarState {
  visible: Ref<boolean>
  message: Ref<string>
  tone: Ref<SnackbarTone>
  notify: (message: string, tone?: SnackbarTone) => void
  reportError: (error: unknown) => void
}

const visible = ref<boolean>(false)
const message = ref<string>('')
const tone = ref<SnackbarTone>('info')

/**
 * Expose the shared notification bar together with the two ways of raising a message.
 */
const useSnackbar = (): SnackbarState => {
  const notify = (text: string, level: SnackbarTone = 'info') => {
    message.value = text
    tone.value = level
    visible.value = true
  }

  /*
   * The reason a failure carries is usually the server's own sentence, which is written in English. A Hebrew
   * page still says in Hebrew that something failed, and quotes the reason after it rather than instead of it.
   */
  const reportError = (error: unknown) => {
    const reason = error instanceof Error && error.message.length > 0 ? error.message : translate('errors.generic')
    const text = language.value === 'he' && reason !== translate('errors.generic')
      ? `${translate('errors.failed')} ${isolate(reason)}`
      : reason
    notify(text, 'error')
  }

  return { visible, message, tone, notify, reportError }
}

export type { SnackbarState, SnackbarTone }
export { useSnackbar }
