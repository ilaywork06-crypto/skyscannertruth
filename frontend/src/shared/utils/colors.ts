/**
 * Stable colours for values: the same text always gets the same hue, so a schema or tag is recognisable
 * at a glance across pages. Hues are theme tokens (`chip-1` … `chip-8`) defined in `app/theme.ts`.
 */

const CHIP_TOKENS = 8

const hash = (text: string): number => {
  let value = 0
  for (let index = 0; index < text.length; index += 1) {
    value = (value * 31 + text.charCodeAt(index)) | 0
  }

  return Math.abs(value)
}

/** The theme colour token for a value. */
const chipColor = (text: string): string => `chip-${(hash(text.trim().toLowerCase()) % CHIP_TOKENS) + 1}`

/** Up to two initials for an avatar. */
const initials = (text: string): string =>
  text
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')

export { CHIP_TOKENS, chipColor, initials }
