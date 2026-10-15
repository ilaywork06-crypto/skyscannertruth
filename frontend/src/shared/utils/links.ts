/**
 * Splitting text into plain runs and links, so URLs inside values are clickable without `v-html`.
 */

interface TextPart {
  text: string
  href: string | null
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi

const splitLinks = (text: string): TextPart[] => {
  const parts: TextPart[] = []
  let last = 0

  for (const match of text.matchAll(URL_PATTERN)) {
    const at = match.index ?? 0
    if (at > last) {
      parts.push({ text: text.slice(last, at), href: null })
    }
    parts.push({ text: match[0], href: match[0] })
    last = at + match[0].length
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last), href: null })
  }

  return parts
}

export type { TextPart }
export { splitLinks }
