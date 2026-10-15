import { describe, expect, it } from 'vitest'

import { collectOptions, runQuery, satisfies } from '@/domain/register/query'
import type { RegisterRow } from '@/domain/register/types'

const row = (overrides: Partial<RegisterRow>): RegisterRow => ({
  id: 'id',
  name: '',
  assumption_text: '',
  proposing_party: '',
  tags: [],
  validation_responsible_parties: [],
  revision: 1,
  creator: '',
  created_at: '2026-01-15T10:00:00Z',
  schemas: [],
  schema_ids: [],
  industries: [],
  industry_ids: [],
  revision_reason: '',
  archived: false,
  deleted: false,
  complete: true,
  values: {},
  ...overrides,
})

const rows = [
  row({ id: 'a', assumption_text: 'Fuel burn is stable', proposing_party: 'Ops', tags: ['x', 'y'], values: { speed: 430 } }),
  row({ id: 'b', assumption_text: 'Radar holds', proposing_party: 'Safety', tags: ['y'], values: { speed: 90 } }),
  row({ id: 'c', assumption_text: 'Crew of two', proposing_party: 'Ops', values: {} }),
]

const query = { search: '', filters: [], sort: [], page: 1, pageSize: 10 }

describe('the in-memory query', () => {
  it('searches case-insensitively, including declared values, but not ids', () => {
    expect(runQuery(rows, { ...query, search: 'FUEL' }).rows.map((item) => item.id)).toEqual(['a'])
    expect(runQuery(rows, { ...query, search: '430' }).total).toBe(1)
    expect(runQuery(rows, { ...query, search: 'id' }).total).toBe(0)
  })

  it('matches a list cell when any of its values matches', () => {
    expect(satisfies(rows[0]!, { key: 'tags', operator: 'in', value: null, values: ['x'] })).toBe(true)
    expect(satisfies(rows[1]!, { key: 'tags', operator: 'not_in', value: null, values: ['x'] })).toBe(true)
  })

  it('compares declared numbers numerically', () => {
    const fast = runQuery(rows, { ...query, filters: [{ key: 'speed', operator: 'greater_than', value: '100', values: [] }] })
    expect(fast.rows.map((item) => item.id)).toEqual(['a'])
  })

  it('compares dates as calendar days', () => {
    const condition = { key: 'created_at', operator: 'equals' as const, value: '2026-01-15', values: [] }
    expect(satisfies(rows[0]!, condition)).toBe(true)
    expect(satisfies(rows[0]!, { ...condition, operator: 'between', value: null, values: ['2026-01-01', '2026-01-15'] })).toBe(true)
  })

  it('sorts with missing values last in either direction, and pages', () => {
    const ascending = runQuery(rows, { ...query, sort: [{ key: 'speed', direction: 'asc' }] })
    expect(ascending.rows.map((item) => item.id)).toEqual(['b', 'a', 'c'])
    const descending = runQuery(rows, { ...query, sort: [{ key: 'speed', direction: 'desc' }], pageSize: 2 })
    expect(descending.rows.map((item) => item.id)).toEqual(['a', 'b'])
    expect(descending.total).toBe(3)
  })

  it('collects the distinct values of a column', () => {
    expect(collectOptions(rows, 'proposing_party')).toEqual(['Ops', 'Safety'])
  })
})
