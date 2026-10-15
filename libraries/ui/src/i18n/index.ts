/**
 * The dictionaries. The library registers the vocabulary of its own components; each client registers its
 * own on top, and a phrase named by both is the client's (the last registration wins). A phrase missing in
 * Hebrew falls back to its English, then to the key, so a dictionary that is behind leaves a few English
 * words rather than holes. Every value written into a phrase is fenced off with the Unicode isolate marks.
 */
import { computed } from 'vue'
import { isolate } from '../lib/bidi'
import { usePreferences, type Language } from '../theme/preferences'
import { SHARED } from './shared'

export type Dictionary = Record<string, string>
export type Translations = Partial<Record<Language, Dictionary>>

const dictionaries: Record<Language, Dictionary> = { en: {}, he: {} }

export function registerTranslations(partial: Translations): void {
  for (const lang of ['en', 'he'] as Language[]) Object.assign(dictionaries[lang], partial[lang] ?? {})
}
registerTranslations(SHARED)

const prefs = usePreferences()

export type Values = Record<string, string | number | null | undefined>

export function translate(key: string, values?: Values): string {
  const lang = prefs.language.value
  const phrase = dictionaries[lang][key] ?? dictionaries.en[key] ?? key
  if (!values) return phrase
  return phrase.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? isolate(String(values[name] ?? '')) : whole,
  )
}

/** Whether the dictionary has a phrase for the key (in either language). */
export function hasPhrase(key: string): boolean {
  return key in dictionaries.en || key in dictionaries.he
}

export function useI18n() {
  return {
    t: translate,
    language: prefs.language,
    isRtl: computed(() => prefs.language.value === 'he'),
    direction: prefs.direction,
    setLanguage: prefs.setLanguage,
  }
}
