/**
 * The industries the inventory was last narrowed to, remembered in this browser.
 *
 * The tabs above the table are a filter rather than a place, and most people work in the same one or two
 * industries every day, so the table opens on the industries it was left on. Nothing picked means every
 * industry. Like the order of the tabs, this is a preference of the person at this browser, and there is no
 * identity to keep it against on the server yet.
 */

const STORAGE_KEY = 'skyscanner.industries.selected'

/**
 * Read the industries the table was last narrowed to, tolerating a storage that was cleared or corrupted.
 */
const readSelectedIndustries = (): string[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw === null ? [] : JSON.parse(raw)

    return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : []
  } catch {
    return []
  }
}

/**
 * Remember the industries the table is narrowed to, ignoring a storage that refuses to be written to.
 */
const writeSelectedIndustries = (keys: string[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch {
    /* A full or disabled storage costs the user the memory of the pick, never the pick itself. */
  }
}

/**
 * Read a pick out of the address, where it is written as one comma separated parameter.
 */
const parseIndustryParam = (value: unknown): string[] | null => {
  if (typeof value !== 'string') {
    return null
  }

  return value
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0)
}

export { STORAGE_KEY, parseIndustryParam, readSelectedIndustries, writeSelectedIndustries }
