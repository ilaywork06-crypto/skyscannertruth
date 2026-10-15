import { describe, expect, it } from 'vitest'

import type { RegisterView, ViewDefaults } from '@/domain/register/view-url'
import { foreignParams, readView, sameQuery, writeView } from '@/domain/register/view-url'

const defaults: ViewDefaults = { sort: [{ key: 'created_at', direction: 'desc' }], pageSize: 25, hiddenColumns: ['schemas'] }
const untouched: RegisterView = { search: '', filters: [], sort: defaults.sort, page: 1, pageSize: 25, hiddenColumns: ['schemas'] }

describe('the view in the address', () => {
  it('keeps an untouched view out of the address', () => {
    expect(writeView(untouched, defaults)).toEqual({})
  })

  it('round-trips every part of a view', () => {
    const view: RegisterView = {
      search: 'fuel',
      filters: [
        { key: 'proposing_party', operator: 'in', value: null, values: ['Ops', 'Safety'] },
        { key: 'created_at', operator: 'between', value: null, values: ['2026-01-01', '2026-02-01'] },
        { key: 'tags', operator: 'is_empty', value: null, values: [] },
        { key: 'speed', operator: 'greater_than', value: '425', values: [] },
      ],
      sort: [{ key: 'speed', direction: 'asc' }, { key: 'created_at', direction: 'desc' }],
      page: 3,
      pageSize: 50,
      hiddenColumns: [],
    }
    const written = writeView(view, defaults)
    expect(written).toMatchObject({ q: 'fuel', 'proposing_party.in': ['Ops', 'Safety'], sort: ['speed', '-created_at'], page: '3', size: '50', hide: '' })
    expect(readView(written, defaults)).toEqual(view)
  })

  it('ignores parameters that are not part of the view, and keeps them', () => {
    const query = { tab: 'x', q: 'a' }
    expect(readView(query, defaults).search).toBe('a')
    expect(foreignParams(query)).toEqual({ tab: 'x' })
  })

  it('compares queries regardless of order', () => {
    expect(sameQuery({ a: '1', b: ['2', '3'] }, { b: ['2', '3'], a: '1' })).toBe(true)
    expect(sameQuery({ a: '1' }, { a: '2' })).toBe(false)
  })

  it('rejects page sizes beyond the largest offered', () => {
    expect(readView({ size: '5000' }, defaults).pageSize).toBe(25)
  })
})
