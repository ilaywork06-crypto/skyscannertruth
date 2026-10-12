/**
 * The two names every declaration carries - one in English, one in Hebrew - and the one a page shows.
 *
 * A declaration is stored under `name`, which everything that reads it relies on, with the Hebrew beside it
 * in `name_he`. Either of the two may be left empty, but not both: a declaration written only in Hebrew is
 * stored with that name in both places, so every reader of `name` still finds something to show.
 */

import { language, translate } from '../composables/useLanguage'
import { humanizeKey } from './format'

/** Anything that carries a name and, perhaps, its Hebrew. */
interface Named {
  name: string
  name_he?: string | null
}

/** The two names as a form holds them, each of them possibly empty. */
interface NamePair {
  english: string
  hebrew: string
}

/** One of the two names. */
type NameSide = keyof NamePair

/** The direction each of the two names is written in, whatever the page around it is set to. */
const NAME_DIRECTIONS: Record<NameSide, 'ltr' | 'rtl'> = { english: 'ltr', hebrew: 'rtl' }

/** A letter of the Hebrew alphabet, which is what tells a Hebrew name apart from an English one. */
const HEBREW_LETTER = /[\u0590-\u05FF]/

/**
 * The order the two name columns of a table stand in.
 *
 * The English name stands to the left of the Hebrew one, which is how the form that writes them lays them out.
 * A Hebrew table runs from the right, so there the Hebrew name comes first; without that the two columns
 * swapped sides between the form and the table, and each name was read on the side of the other language.
 */
const nameColumnOrder = (): NameSide[] => (language.value === 'he' ? ['hebrew', 'english'] : ['english', 'hebrew'])

/**
 * The name to show for a declaration in the language the interface is written in.
 */
const localName = (item: Named): string => {
  const hebrew = (item.name_he ?? '').trim()

  return language.value === 'he' && hebrew.length > 0 ? hebrew : item.name
}

/**
 * The name to show for a value out of a vocabulary, in the language the interface is written in.
 */
const localLabel = (label: string, labelHebrew: string | null | undefined): string =>
  language.value === 'he' && (labelHebrew ?? '').trim().length > 0 ? (labelHebrew ?? '').trim() : label

/**
 * Read a stored declaration back into the two fields of a form.
 *
 * A declaration written only in Hebrew carries that name as its `name` too, and it is shown as a Hebrew
 * name alone rather than as the same word twice.
 */
const splitNames = (item: Named): NamePair => {
  const hebrew = (item.name_he ?? '').trim()
  const english = item.name.trim()
  const onlyHebrew = hebrew.length > 0 && english === hebrew && HEBREW_LETTER.test(english)

  return { english: onlyHebrew ? '' : english, hebrew }
}

/**
 * Write the two fields of a form into the shape a declaration is stored in.
 */
const joinNames = (pair: NamePair): { name: string; name_he: string } => {
  const english = pair.english.trim()
  const hebrew = pair.hebrew.trim()

  return { name: english.length > 0 ? english : hebrew, name_he: hebrew }
}

/**
 * Whether at least one of the two names was written, which is all a declaration asks for.
 */
const hasAName = (pair: NamePair): boolean => pair.english.trim().length > 0 || pair.hebrew.trim().length > 0

/**
 * The label of a stored value of a fixed vocabulary - a status, a result - in the language of the page.
 *
 * A product registers the words of its own vocabularies under `enum.<stored value>`; a value nobody wrote a
 * word for reads as its key, made readable.
 */
const valueLabel = (value: string): string => {
  if (value.length === 0) {
    return ''
  }

  const key = `enum.${value}`
  const phrase = translate(key)

  return phrase === key ? humanizeKey(value) : phrase
}

export type { NamePair, NameSide, Named }
export {
  HEBREW_LETTER,
  NAME_DIRECTIONS,
  hasAName,
  joinNames,
  localLabel,
  localName,
  nameColumnOrder,
  splitNames,
  valueLabel,
}
