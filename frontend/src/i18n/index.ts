/**
 * Translation: the current language and `t()`. Values from the register itself (industry, schema and
 * attribute names) are never translated - only the interface's own words.
 */

import { computed, ref } from 'vue'

import type { Language } from '@/domain/scheme'
import { readStored, writeStored } from '@/shared/utils/storage'

import type { MessageKey } from './en'
import { en } from './en'
import { he } from './he'

type Params = Record<string, string | number>

const STORAGE_KEY = 'truth.language'
const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { en, he }

const initial = readStored(STORAGE_KEY)
const language = ref<Language>(initial === 'he' ? 'he' : 'en')

const interpolate = (template: string, params: Params): string =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))

/**
 * Translate a key. Unknown keys (e.g. built at runtime) fall back to the key itself so a gap is visible
 * rather than blank.
 */
const t = (key: MessageKey | string, params: Params = {}): string => {
  const template = DICTIONARIES[language.value][key as MessageKey] ?? en[key as MessageKey] ?? key

  return interpolate(template, params)
}

const setLanguage = (next: Language): void => {
  language.value = next
  writeStored(STORAGE_KEY, next)
}

const isRtl = computed<boolean>(() => language.value === 'he')

const useI18n = () => ({ t, language, isRtl, setLanguage })

export type { MessageKey, Params }
export { isRtl, language, setLanguage, t, useI18n }
