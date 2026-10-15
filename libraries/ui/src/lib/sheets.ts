/** Reading a delimited text or a workbook into rows, for the file viewer. */
export interface SheetContent {
  rows: string[][]
  truncated: boolean
}

export function delimiterOf(suffix: string, text: string): string {
  if (suffix === 'tsv' || suffix === 'tab') return '\t'
  const sample = text.slice(0, 4096).split('\n')[0] ?? ''
  const counts: [string, number][] = [',', ';', '\t'].map((d) => [d, sample.split(d).length - 1])
  let best = counts[0]
  for (const c of counts) if (c[1] > best[1]) best = c
  return best[1] === 0 ? ',' : best[0]
}

/** RFC 4180, stopping after `rowLimit` rows. */
export function parseDelimited(text: string, delimiter: string, rowLimit: number): SheetContent {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === delimiter) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      if (rows.length >= rowLimit) return { rows, truncated: i + 1 < text.length }
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  return { rows, truncated: false }
}

/** A window of a large text taken by byte offset starts and ends mid-line: keep whole lines only. */
export function wholeLines(text: string, atStart: boolean, atEnd: boolean): { text: string; offset: number } {
  let offset = 0
  let out = text
  if (!atStart) {
    const first = out.indexOf('\n')
    if (first === -1) return { text: '', offset: text.length }
    offset = first + 1
    out = out.slice(offset)
  }
  if (!atEnd) {
    const last = out.lastIndexOf('\n')
    out = last === -1 ? '' : out.slice(0, last)
  }
  return { text: out, offset }
}
