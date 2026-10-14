/**
 * Addresses inside a value, read back out so they can be followed. Only what the browser's own URL parser
 * says is http, https or mailto becomes a link; the characters shown are always the ones somebody typed.
 */
export interface LinkSegment {
  text: string
  href: string | null
}

const PATTERN = /(?:https?:\/\/|mailto:|www\.)[^\s<>"'`]+|[\w.!#$%&'*+/=?^-]+@[\w-]+(?:\.[\w-]+)+/gi
const ALLOWED = ['http:', 'https:', 'mailto:']
const OPENERS: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

function count(text: string, char: string): number {
  let n = 0
  for (const c of text) if (c === char) n++
  return n
}

/** Trailing punctuation is the sentence's, and a closing bracket is the address's only if it opened one. */
function trimTrailing(match: string): string {
  let text = match
  for (;;) {
    text = text.replace(/[.,;:!?'"’”]+$/, '')
    const last = text.charAt(text.length - 1)
    const opener = OPENERS[last]
    if (!opener) return text
    if (count(text, opener) >= count(text, last)) return text
    text = text.slice(0, -1)
  }
}

function hrefFor(text: string): string | null {
  const candidate = /^[a-z][\w+.-]*:/i.test(text) ? text : text.includes('@') ? `mailto:${text}` : `https://${text}`
  try {
    const url = new URL(candidate)
    return ALLOWED.includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

export function splitLinks(value: string): LinkSegment[] {
  if (!value) return []
  const out: LinkSegment[] = []
  const re = new RegExp(PATTERN.source, 'gi')
  let read = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(value))) {
    const candidate = trimTrailing(m[0])
    const href = candidate ? hrefFor(candidate) : null
    if (!href) {
      re.lastIndex = m.index + Math.max(candidate.length, 1)
      continue
    }
    if (m.index > read) out.push({ text: value.slice(read, m.index), href: null })
    out.push({ text: candidate, href })
    read = re.lastIndex = m.index + candidate.length
  }
  if (!out.length) return [{ text: value, href: null }]
  if (read < value.length) out.push({ text: value.slice(read), href: null })
  return out
}

export function holdsLink(value: string): boolean {
  return splitLinks(value).some((s) => s.href !== null)
}
