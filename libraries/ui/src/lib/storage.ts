/**
 * localStorage that never throws - a private window, a full quota or storage blocked by policy is a
 * preference that is not remembered, not a page that fails to load.
 */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      /* not remembered, nothing else */
    }
  },
  json<T>(key: string, fallback: T): T {
    const raw = storage.get(key)
    if (raw === null) return fallback
    try {
      return JSON.parse(raw) as T
    } catch {
      return fallback
    }
  },
  setJson(key: string, value: unknown): void {
    storage.set(key, value === undefined ? null : JSON.stringify(value))
  },
}
