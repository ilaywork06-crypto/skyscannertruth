/**
 * The colour a vocabulary value is drawn in. A value with no declared colour is hashed into one of six
 * tones - the same Java-style hash as before, so a value keeps its colour across the rewrite.
 */
import type { BadgeTone } from '../components/ui/variants'

export const CHIP_TONES: BadgeTone[] = ['warning', 'blue', 'violet', 'pink', 'orange', 'success']
/** The names the original palette used, in the same order, for declarations that stored one. */
export const CHIP_COLOUR_NAMES = ['amber', 'blue', 'violet', 'rose', 'coral', 'green'] as const

export function hashText(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return hash
}

export function hashedTone(value: string): BadgeTone {
  return CHIP_TONES[Math.abs(hashText(value)) % CHIP_TONES.length]
}

/** A stored colour name (`industryBlue`, `chip-industry-blue`, `blue`) to a tone; unknown → hashed. */
export function toneOfColour(colour: string | null | undefined, fallbackKey: string): BadgeTone {
  if (!colour) return hashedTone(fallbackKey)
  const name = colour.replace(/^chip-industry-|^chip-|^industry/i, '').toLowerCase()
  const i = CHIP_COLOUR_NAMES.indexOf(name as (typeof CHIP_COLOUR_NAMES)[number])
  return i === -1 ? hashedTone(fallbackKey) : CHIP_TONES[i]
}
