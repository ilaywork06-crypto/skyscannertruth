import type { Translations } from '@truth-platform/ui'
import { EXTRA } from './extra'
import { ORIGINAL } from './original'

export const DICTIONARY: Translations = {
  en: { ...ORIGINAL.en, ...EXTRA.en },
  he: { ...ORIGINAL.he, ...EXTRA.he },
}
