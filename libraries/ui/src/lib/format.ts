/**
 * How values are written out. Moments are shown in the reader's own time zone and always in the day-first
 * en-GB shape, on a Hebrew page as well - a date is not a sentence and its digit order does not flip.
 */
export const EMPTY_PLACEHOLDER = '—'

type Moment = string | number | Date | null | undefined

function toDate(value: Moment): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(value: Moment): string {
  const d = toDate(value)
  return d ? d.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' }) : EMPTY_PLACEHOLDER
}

export function formatDateTime(value: Moment): string {
  const d = toDate(value)
  return d
    ? d.toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    : EMPTY_PLACEHOLDER
}

/** `DD/MM/YY, HH:MM` - the bookkeeping columns (created, changed). */
export function formatCompactDateTime(value: Moment): string {
  const d = toDate(value)
  return d
    ? d.toLocaleString('en-GB', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    : EMPTY_PLACEHOLDER
}

/** "3 minutes ago" in the page language. */
export function timeAgo(value: Moment, language: string): string {
  const d = toDate(value)
  if (!d) return EMPTY_PLACEHOLDER
  const seconds = (d.getTime() - Date.now()) / 1000
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60],
  ]
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  return rtf.format(Math.round(seconds), 'second')
}

export function formatBytes(n: number | null | undefined): string {
  if (!n || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exp = Math.min(Math.floor(Math.log(n) / Math.log(1024)), 4)
  return `${(n / 1024 ** exp).toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`
}

export function formatNumber(n: number, language = 'en'): string {
  return new Intl.NumberFormat(language === 'he' ? 'he-IL' : 'en-US').format(n)
}

/** A date input's `YYYY-MM-DD` as the UTC moment of local midnight. */
export function toIsoDate(input: string): string | null {
  if (!input) return null
  const d = new Date(`${input}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** The local day of a stored moment, for a date input (never the UTC day of the ISO string). */
export function toDateInput(value: Moment): string {
  const d = toDate(value)
  if (!d) return ''
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function humanizeKey(key: string): string {
  return key
    .split(/[_.-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`
}

export function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/** A key out of a name - English letters, digits and `_`, case kept. */
export function toKey(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export function isValidKey(value: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(value.trim())
}
