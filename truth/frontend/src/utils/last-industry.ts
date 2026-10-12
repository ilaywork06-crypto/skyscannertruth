/**
 * The industry a reader was last reading, so that opening the client lands them back in it.
 *
 * Held in the browser rather than anywhere shared: it is where one person left off, not a setting of the
 * register. A browser that refuses its storage - a private window, or one told to block site data - throws
 * rather than answering, and the client then simply opens on the list of industries.
 */

const STORAGE_KEY = 'truth.industry.last'

/**
 * Read the identifier of the industry last read in this browser, or nothing when there is none.
 */
const readLastIndustry = (): string | null => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)

    return stored !== null && stored.length > 0 ? stored : null
  } catch {
    return null
  }
}

/**
 * Remember the industry being read, or forget it when it turned out not to exist.
 */
const writeLastIndustry = (industryId: string | null): void => {
  try {
    if (industryId === null) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, industryId)
    }
  } catch {
    /* The page still opens on the list of industries next time, which is the part that matters. */
  }
}

export { readLastIndustry, writeLastIndustry }
