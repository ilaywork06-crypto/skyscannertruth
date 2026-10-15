import { describe, expect, it } from 'vitest'

import { PAGE_SIZE, forEachConcurrently, readAll } from '@/api/paging'

describe('reading whole collections', () => {
  it('asks page after page until one comes back short', async () => {
    const all = Array.from({ length: PAGE_SIZE * 2 + 3 }, (_, index) => index)
    const asked: number[] = []
    const read = await readAll(async (offset, limit) => {
      asked.push(offset)

      return all.slice(offset, offset + limit)
    })
    expect(read).toEqual(all)
    expect(asked).toEqual([0, PAGE_SIZE, PAGE_SIZE * 2])
  })

  it('never runs more tasks at once than allowed', async () => {
    let running = 0
    let peak = 0
    await forEachConcurrently(Array.from({ length: 20 }, (_, index) => index), 6, async () => {
      running += 1
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 1))
      running -= 1
    })
    expect(peak).toBe(6)
  })
})
