/** Checking the values of an assumption against the fields its schemas declare - the first problem per field. */
import { joinIsolated, translate } from '@truth-platform/ui'
import type { JsonValue } from '@/models'
import { fieldLabel, hasOptions, isNumeric, type SchemeField } from './scheme'

export function isFilled(value: JsonValue | undefined): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

export function asNumber(value: JsonValue): number | null {
  const n = typeof value === 'number' ? value : Number(String(value))
  return Number.isNaN(n) ? null : n
}

export function checkNumber(field: SchemeField, value: JsonValue): string | null {
  const name = fieldLabel(field)
  const n = asNumber(value)
  if (n === null) return translate('check.number', { name })
  if (field.type === 'confined_number' && !Number.isInteger(n)) return translate('check.whole', { name })
  if (field.min !== null && n < field.min) return translate('check.min', { name, min: field.min })
  if (field.max !== null && n > field.max) return translate('check.max', { name, max: field.max })
  if (field.step !== null && field.step > 0) {
    const steps = (n - (field.min ?? 0)) / field.step
    if (Math.abs(steps - Math.round(steps)) > 1e-9) {
      return field.min === null
        ? translate('check.step', { name, step: field.step })
        : translate('check.stepFrom', { name, step: field.step, min: field.min })
    }
  }
  return null
}

export function checkField(field: SchemeField, value: JsonValue | undefined): string | null {
  const name = fieldLabel(field)
  if (!isFilled(value)) return field.required ? translate('check.required', { name }) : null
  const held = value as JsonValue
  const values: JsonValue[] = field.array && Array.isArray(held) ? held : [held]
  for (const single of values) {
    if (hasOptions(field.type) && field.options.length > 0 && !field.options.includes(String(single))) {
      return translate('check.oneOf', { name, options: joinIsolated(field.options) })
    }
    if (isNumeric(field.type)) {
      const complaint = checkNumber(field, single)
      if (complaint !== null) return complaint
    }
  }
  return null
}

export function validateValues(fields: SchemeField[], values: Record<string, JsonValue>): Record<string, string> {
  const problems: Record<string, string> = {}
  for (const field of fields) {
    const complaint = checkField(field, values[field.key])
    if (complaint !== null) problems[field.key] = complaint
  }
  return problems
}
