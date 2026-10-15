/**
 * Formatting values for display, in the interface's language.
 */

import type { JsonValue } from '@/domain/json'
import { language, t } from '@/i18n'

const PLAIN_DAY = /^\d{4}-\d{2}-\d{2}$/

const locale = (): string => (language.value === 'he' ? 'he-IL' : 'en-GB')

const parse = (value: string): Date | null => {
  const moment = PLAIN_DAY.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)

  return Number.isNaN(moment.getTime()) ? null : moment
}

const formatDate = (value: string): string => {
  const moment = parse(value)

  return moment === null ? value : moment.toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateTime = (value: string): string => {
  const moment = parse(value)

  return moment === null
    ? value
    : moment.toLocaleString(locale(), { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** "3 days ago", in the interface's language. */
const formatRelative = (value: string): string => {
  const moment = parse(value)
  if (moment === null) {
    return value
  }
  const seconds = Math.round((moment.getTime() - Date.now()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ]
  const format = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit)
    }
  }

  return format.format(seconds, 'second')
}

const formatNumber = (value: number): string => value.toLocaleString(locale(), { maximumFractionDigits: 6 })

/** Render any value as one line of text. */
const formatValue = (value: JsonValue | undefined): string => {
  if (value === null || value === undefined) {
    return ''
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item)).join(', ')
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    return formatNumber(value)
  }
  if (typeof value === 'boolean') {
    return value ? t('common.yes') : t('common.no')
  }

  return String(value)
}

export { formatDate, formatDateTime, formatNumber, formatRelative, formatValue }
