/** Toasts, and the one rule for reporting a failure: a Hebrew page puts a Hebrew headline before the server's English reason. */
import { toast } from 'vue-sonner'
import { isolate } from '../lib/bidi'
import { translate } from '../i18n'
import { usePreferences } from '../theme/preferences'

export function notify(message: string, level: 'success' | 'error' | 'info' | 'warning' = 'success', description?: string): void {
  const fn = level === 'success' ? toast.success : level === 'error' ? toast.error : level === 'warning' ? toast.warning : toast.info
  fn(message, description ? { description } : undefined)
}

export function errorMessage(error: unknown): string {
  const generic = translate('errors.generic')
  const reason = error instanceof Error && error.message ? error.message : generic
  if (usePreferences().language.value === 'he' && reason !== generic) return `${translate('errors.failed')} ${isolate(reason)}`
  return reason
}

export function reportError(error: unknown): void {
  toast.error(errorMessage(error))
}
