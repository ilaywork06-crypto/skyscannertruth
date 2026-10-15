/** Who the client writes as, where the reader left off, and the name an assumption is stored under. */
import { storage } from '@truth-platform/ui'

/** There is no user management: every write is made as VITE_DEFAULT_CREATOR, or `unknown`. */
export const ANONYMOUS = 'unknown'
export function readCreator(): string {
  const configured = (import.meta.env.VITE_DEFAULT_CREATOR ?? '').trim()
  return configured.length > 0 ? configured : ANONYMOUS
}

/** The industry last read in this browser (same key as before the rewrite). */
const LAST_INDUSTRY_KEY = 'truth.industry.last'
export function readLastIndustry(): string | null {
  const v = storage.get(LAST_INDUSTRY_KEY)
  return v && v.length > 0 ? v : null
}
export function writeLastIndustry(id: string | null): void {
  storage.set(LAST_INDUSTRY_KEY, id)
}

/** The API requires a name: the first line of the text, at most 80 characters. */
export const NAME_LIMIT = 80
export function deriveName(text: string): string {
  const first = (text.trim().split(/\r?\n/)[0] ?? '').trim()
  return first.length <= NAME_LIMIT ? first : `${first.slice(0, NAME_LIMIT - 1).trimEnd()}…`
}

export function sortCaseless(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
