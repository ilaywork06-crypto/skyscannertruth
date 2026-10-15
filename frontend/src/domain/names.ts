/**
 * Keys and display names of declared attributes.
 */

/** A key is English letters, digits and underscores, starting with a letter or underscore. */
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

const isValidKey = (key: string): boolean => KEY_PATTERN.test(key)

/** Derive a key from an English display name: "Cruise speed (kn)" → "cruise_speed_kn". */
const toKey = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1')

/** Turn a key into something readable: "cruise_speed" → "Cruise speed". */
const humanizeKey = (key: string): string => {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()

  return spaced.length === 0 ? key : spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export { isValidKey, humanizeKey, toKey }
