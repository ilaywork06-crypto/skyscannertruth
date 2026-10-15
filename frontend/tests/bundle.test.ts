import { describe, expect, it } from 'vitest'

import { BUNDLE_FORMAT, assumptionDraft, nameResolver, planRestore, readBundle } from '@/domain/bundle'

describe('bundles', () => {
  it('refuses a file that is not a bundle', () => {
    expect(readBundle('{"hello": 1}')).toBeNull()
    expect(readBundle('not json')).toBeNull()
  })

  it('reads a hand-edited bundle, treating what is missing as empty', () => {
    const bundle = readBundle(JSON.stringify({ format: BUNDLE_FORMAT, assumptions: [{ name: 'A' }] }))
    expect(bundle?.assumptions[0]).toMatchObject({ name: 'A', tags: [], values: {}, revision: 1 })
  })

  it('plans only what is not already there', () => {
    const bundle = readBundle(
      JSON.stringify({
        format: BUNDLE_FORMAT,
        industries: [{ name: 'Aviation' }, { name: 'Space' }],
        schemas: [{ name: 'S' }],
        assumptions: [
          { name: 'A', assumption_text: 'one' },
          { name: 'B', assumption_text: 'two' },
        ],
      }),
    )
    const plan = planRestore(bundle, { industries: ['Aviation'], schemas: ['S'], assumptions: [{ name: 'A', text: 'one' }] })
    expect(plan.industries.map((item) => item.name)).toEqual(['Space'])
    expect(plan.schemas).toHaveLength(0)
    expect(plan.skipped).toBe(1)
    expect(plan.total).toBe(2)
  })

  it('resolves names to ids where it can and keeps the bundled creator', () => {
    const resolve = { schema: nameResolver([{ id: 's1', name: 'S' }]), industry: nameResolver([]) }
    const bundle = readBundle(JSON.stringify({ format: BUNDLE_FORMAT, assumptions: [{ name: 'A', schemas: ['S', 'T'], industries: ['X'], creator: 'dana' }] }))!
    const draft = assumptionDraft(bundle.assumptions[0]!, 'me', resolve)
    expect(draft.schemas).toEqual(['s1', 'T'])
    expect(draft.industries).toEqual(['X'])
    expect(draft.creator).toBe('dana')
  })
})
