import { describe, expect, it } from 'vitest'

import { fieldLabel, fieldNames, isSchemeValid, mergeFields, readField, readScheme, readType, schemeProblems, withNames, writeField } from '@/domain/scheme'
import { emptyField } from '@/domain/scheme'

describe('reading a scheme generously', () => {
  it('reads aliases for key, label and type', () => {
    const field = readField({ field: 'cruise_speed', label: 'Cruise speed', type: 'number', mandatory: 'yes' })
    expect(field).toMatchObject({ key: 'cruise_speed', displayName: 'Cruise speed', type: 'confined_number', required: true })
  })

  it('understands the one-entry shorthand', () => {
    expect(readField({ berth_count: 'int' })).toMatchObject({ key: 'berth_count', displayName: 'Berth count', type: 'confined_number' })
  })

  it('reads list types as arrays', () => {
    expect(readType({ type: 'list[str]' })).toEqual({ type: 'string', array: true })
    expect(readType({ type: 'float[]' })).toEqual({ type: 'confined_float', array: true })
    expect(readType({ options: ['a'] })).toEqual({ type: 'enum', array: false })
  })

  it('skips entries without a key', () => {
    expect(readScheme({ fields: [{ label: 'nameless', type: 'string', extra: 1 }, { key: 'ok' }] })).toHaveLength(1)
  })
})

describe('writing a scheme strictly', () => {
  it('writes the five required keys and carries unknown keys through', () => {
    const field = readField({ key: 'speed', label: 'Speed', type: 'float', unit: 'kn', min: '0' })!
    expect(writeField(field)).toEqual({ unit: 'kn', key: 'speed', display_name: 'Speed', type: 'confined_float', required: false, array: false, min: 0 })
  })

  it('does not leave a stale alias behind', () => {
    const written = writeField(readField({ key: 'x', label: 'Old label', type: 'string' })!)
    expect(written).not.toHaveProperty('label')
  })

  it('writes options only for enumerations', () => {
    const field = { ...emptyField(), key: 'c', displayName: 'C', type: 'enum' as const, options: ['A', 'B'] }
    expect(writeField(field).options).toEqual(['A', 'B'])
    expect(writeField({ ...field, type: 'string' })).not.toHaveProperty('options')
  })
})

describe('names', () => {
  it('prefers the Hebrew name on a Hebrew page', () => {
    const field = { ...emptyField(), key: 'k', displayName: 'Speed', displayNameHebrew: 'מהירות' }
    expect(fieldLabel(field, 'he')).toBe('מהירות')
    expect(fieldLabel(field, 'en')).toBe('Speed')
  })

  it('stores a Hebrew-only name in both slots and edits it back as Hebrew only', () => {
    const named = withNames(emptyField(), { en: '', he: 'מהירות' })
    expect(named.displayName).toBe('מהירות')
    expect(fieldNames(named)).toEqual({ en: '', he: 'מהירות' })
  })
})

describe('merging and validating', () => {
  it('keeps the first declaration and fills a missing Hebrew name from a later one', () => {
    const first = { ...emptyField(), key: 'a', displayName: 'A' }
    const later = { ...emptyField(), key: 'a', displayName: 'Other', displayNameHebrew: 'א' }
    expect(mergeFields([[first], [later]])).toEqual([{ ...first, displayNameHebrew: 'א' }])
  })

  it('reports duplicate keys, bad keys and missing options', () => {
    const base = { ...emptyField(), displayName: 'X' }
    const problems = schemeProblems([
      { ...base, key: 'dup' },
      { ...base, key: 'dup' },
      { ...base, key: '9 bad' },
      { ...base, key: 'e', type: 'enum' },
    ])
    expect(problems).toEqual(['schemas.problem.keyTaken', 'schemas.problem.keyTaken', 'schemas.problem.keyInvalid', 'schemas.problem.optionsRequired'])
    expect(isSchemeValid([{ ...base, key: 'fine' }])).toBe(true)
  })
})
