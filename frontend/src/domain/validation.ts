/**
 * Checking filled-in assumption values against what their schemas declare.
 *
 * The service has the last word; this catches mistakes beside the field that caused them. Messages are
 * returned as i18n keys with parameters so the domain stays language-free.
 */

import type { JsonValue } from './json'
import { isFilled } from './json'
import type { SchemeField } from './scheme'
import { hasOptions, isNumeric } from './scheme'

interface ValueProblem {
  message: string
  params: Record<string, string | number>
}

/** Tolerance for floating point step arithmetic (0.1 * 3 !== 0.3). */
const STEP_TOLERANCE = 1e-9

const asNumber = (value: JsonValue): number | null => {
  const parsed = typeof value === 'number' ? value : Number(String(value))

  return Number.isNaN(parsed) ? null : parsed
}

const checkNumber = (field: SchemeField, value: JsonValue): ValueProblem | null => {
  const number = asNumber(value)
  if (number === null) {
    return { message: 'check.number', params: {} }
  }
  if (field.type === 'confined_number' && !Number.isInteger(number)) {
    return { message: 'check.whole', params: {} }
  }
  if (field.min !== null && number < field.min) {
    return { message: 'check.min', params: { min: field.min } }
  }
  if (field.max !== null && number > field.max) {
    return { message: 'check.max', params: { max: field.max } }
  }
  if (field.step !== null && field.step > 0) {
    const from = field.min ?? 0
    const steps = (number - from) / field.step
    if (Math.abs(steps - Math.round(steps)) > STEP_TOLERANCE) {
      return field.min === null
        ? { message: 'check.step', params: { step: field.step } }
        : { message: 'check.stepFrom', params: { step: field.step, min: field.min } }
    }
  }

  return null
}

/** The first problem with one field's value, or `null`. */
const checkField = (field: SchemeField, value: JsonValue | undefined): ValueProblem | null => {
  if (!isFilled(value)) {
    return field.required ? { message: 'check.required', params: {} } : null
  }

  const held = value as JsonValue
  const values = field.array && Array.isArray(held) ? held : [held]

  for (const single of values) {
    if (hasOptions(field.type) && field.options.length > 0 && !field.options.includes(String(single))) {
      return { message: 'check.oneOf', params: { options: field.options.join(', ') } }
    }
    if (isNumeric(field.type)) {
      const problem = checkNumber(field, single)
      if (problem !== null) {
        return problem
      }
    }
  }

  return null
}

/** Check every field; the result is keyed by field key and holds only fields with a problem. */
const validateValues = (fields: SchemeField[], values: Record<string, JsonValue>): Record<string, ValueProblem> => {
  const problems: Record<string, ValueProblem> = {}

  for (const field of fields) {
    const problem = checkField(field, values[field.key])
    if (problem !== null) {
      problems[field.key] = problem
    }
  }

  return problems
}

/** The bounds of a numeric field as i18n fragments, for a hint beside the input. */
const describeBounds = (field: SchemeField): ValueProblem[] => {
  if (!isNumeric(field.type)) {
    return []
  }
  const parts: ValueProblem[] = []
  if (field.min !== null && field.max !== null) {
    parts.push({ message: 'bounds.between', params: { min: field.min, max: field.max } })
  } else if (field.min !== null) {
    parts.push({ message: 'bounds.atLeast', params: { min: field.min } })
  } else if (field.max !== null) {
    parts.push({ message: 'bounds.atMost', params: { max: field.max } })
  }
  if (field.step !== null) {
    parts.push({ message: 'bounds.step', params: { step: field.step } })
  }

  return parts
}

export type { ValueProblem }
export { checkField, describeBounds, validateValues }
