/** Things named in English, in Hebrew, or in both. */
import { translate } from '../i18n'
import { usePreferences } from '../theme/preferences'
import { humanizeKey } from './format'

export const NAME_DIRECTIONS = { english: 'ltr', hebrew: 'rtl' } as const
export const HEBREW_LETTER = /[֐-׿]/

export interface NamePair {
  english: string
  hebrew: string
}
export type NameSide = keyof NamePair

const isHebrew = () => usePreferences().language.value === 'he'

/** The columns of a two-name table, the page's own language first. */
export function nameColumnOrder(): NameSide[] {
  return isHebrew() ? ['hebrew', 'english'] : ['english', 'hebrew']
}

/** The name to show: the Hebrew one on a Hebrew page when there is one. */
export function localName(item: { name: string; name_he?: string | null }): string {
  const he = item.name_he?.trim()
  return isHebrew() && he ? he : item.name
}

export function localLabel(label: string, labelHebrew?: string | null): string {
  const he = labelHebrew?.trim()
  return isHebrew() && he ? he : label
}

/** Back into the two boxes of a form; a declaration written only in Hebrew has no English name. */
export function splitNames(item: { name: string; name_he?: string | null }): NamePair {
  const hebrew = (item.name_he ?? '').trim()
  let english = item.name.trim()
  if (hebrew && english === hebrew && HEBREW_LETTER.test(english)) english = ''
  return { english, hebrew }
}

export function joinNames(pair: NamePair): { name: string; name_he: string } {
  return { name: pair.english.trim() || pair.hebrew.trim(), name_he: pair.hebrew.trim() }
}

export function hasAName(pair: NamePair): boolean {
  return !!pair.english.trim() || !!pair.hebrew.trim()
}

/** A stored vocabulary value (`in_progress`) as words, from the dictionary's `enum.*` or from the key. */
export function valueLabel(value: string | null | undefined): string {
  if (!value) return ''
  const key = `enum.${value}`
  const phrase = translate(key)
  return phrase === key ? humanizeKey(value) : phrase
}
