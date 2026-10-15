/**
 * Browser storage that never throws - a private window or blocked site data simply forgets.
 */

type Area = 'local' | 'session'

const area = (which: Area): Storage | null => {
  try {
    return which === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

const readStored = (key: string, which: Area = 'local'): string | null => {
  try {
    return area(which)?.getItem(key) ?? null
  } catch {
    return null
  }
}

const writeStored = (key: string, value: string | null, which: Area = 'local'): void => {
  try {
    const store = area(which)
    if (value === null) {
      store?.removeItem(key)
    } else {
      store?.setItem(key, value)
    }
  } catch {
    /* Remembering is a convenience; forgetting is harmless. */
  }
}

export { readStored, writeStored }
