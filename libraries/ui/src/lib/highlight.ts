/** Painting a search term inside a value, and showing the part of a long value where it matched. */
import { truncate } from './format'

export interface Highlight {
  text: string
  matched: boolean
}

const norm = (term: string) => term.trim().toLowerCase()

export function matchesTerm(value: string | null | undefined, term: string | null | undefined): boolean {
  const needle = norm(term ?? '')
  return !!needle && !!value && value.toLowerCase().includes(needle)
}

/** Lower-cases by code point, remembering where each lowered unit came from in the original. */
function lowerWithBounds(value: string): { lower: string; start: number[]; end: number[] } {
  let lower = ''
  const start: number[] = []
  const end: number[] = []
  let offset = 0
  for (const ch of value) {
    const l = ch.toLowerCase()
    for (let i = 0; i < l.length; i++) {
      start.push(offset)
      end.push(offset + ch.length)
    }
    lower += l
    offset += ch.length
  }
  return { lower, start, end }
}

/** Runs of matched and unmatched text; empty when nothing matches (render the value plainly). */
export function splitHighlights(value: string, term: string): Highlight[] {
  const needle = norm(term)
  if (!needle || !value) return []
  const direct = value.toLowerCase().length === value.length
  const { lower, start, end } = direct
    ? { lower: value.toLowerCase(), start: [] as number[], end: [] as number[] }
    : lowerWithBounds(value)
  const at = (i: number) => (direct ? i : (start[i] ?? value.length))
  const until = (i: number) => (direct ? i + 1 : (end[i] ?? value.length))
  const out: Highlight[] = []
  let cursor = 0
  let found = false
  let i = lower.indexOf(needle)
  while (i !== -1) {
    const s = at(i)
    const e = until(i + needle.length - 1)
    if (s >= cursor && e > s) {
      if (s > cursor) out.push({ text: value.slice(cursor, s), matched: false })
      out.push({ text: value.slice(s, e), matched: true })
      cursor = e
      found = true
    }
    i = lower.indexOf(needle, i + needle.length)
  }
  if (!found) return []
  if (cursor < value.length) out.push({ text: value.slice(cursor), matched: false })
  return out
}

/** A window of `limit` characters, moved to the first match when the match would be cut off. */
export function previewAround(value: string, term: string, limit: number): string {
  const needle = norm(term)
  if (!needle || value.length <= limit) return truncate(value, limit)
  const match = value.toLowerCase().indexOf(needle)
  if (match === -1 || match + needle.length <= limit - 1) return truncate(value, limit)
  const from = Math.max(0, match - 12)
  const lead = from === 0 ? '' : '…'
  return lead + truncate(value.slice(from), limit - lead.length)
}
