/**
 * Turning anything thrown into a sentence for a person.
 */

import { ApiError } from '@/api'
import { t } from '@/i18n'

const errorMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.network) {
    return t('errors.network')
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  return t('errors.generic')
}

export { errorMessage }
