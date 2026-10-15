import { describe, expect, it } from 'vitest'

import { emptyField } from '@/domain/scheme'
import { checkField, validateValues } from '@/domain/validation'

const number = { ...emptyField(), key: 'n', displayName: 'N', type: 'confined_number' as const }

describe('checking values', () => {
  it('requires required fields', () => {
    expect(checkField({ ...number, required: true }, null)?.message).toBe('check.required')
    expect(checkField(number, null)).toBeNull()
  })

  it('checks bounds, whole numbers and steps from the minimum', () => {
    expect(checkField({ ...number, min: 10 }, 5)?.message).toBe('check.min')
    expect(checkField({ ...number, max: 10 }, 11)?.message).toBe('check.max')
    expect(checkField(number, 1.5)?.message).toBe('check.whole')
    expect(checkField({ ...number, min: 10, step: 5 }, 15)).toBeNull()
    expect(checkField({ ...number, min: 10, step: 5 }, 12)?.message).toBe('check.stepFrom')
  })

  it('tolerates floating point steps', () => {
    expect(checkField({ ...number, type: 'confined_float', step: 0.1 }, 0.3)).toBeNull()
  })

  it('checks every value of a list and enumeration options', () => {
    const choice = { ...emptyField(), key: 'c', type: 'enum' as const, options: ['A', 'B'], array: true }
    expect(checkField(choice, ['A', 'B'])).toBeNull()
    expect(checkField(choice, ['A', 'Z'])?.message).toBe('check.oneOf')
  })

  it('keys problems by field', () => {
    expect(Object.keys(validateValues([{ ...number, required: true }], {}))).toEqual(['n'])
  })
})
