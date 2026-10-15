/** Reading values out of a row by a dotted path. */
export function readPath(row: unknown, path: string): unknown {
  let cur: unknown = row
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return null
    cur = (cur as Record<string, unknown>)[part]
    if (cur === undefined) return null
  }
  return cur ?? null
}

export function readText(row: unknown, path: string): string {
  return valueText(readPath(row, path))
}

export function valueText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map((v) => (v === null || typeof v !== 'object' ? String(v) : JSON.stringify(v))).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
