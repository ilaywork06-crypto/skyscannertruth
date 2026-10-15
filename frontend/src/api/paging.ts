/**
 * Reading a whole collection out of offset/limit listings that never report a total.
 * A page that comes back short is the only signal that the end was reached.
 */

const PAGE_SIZE = 100
/** Guards against a service that keeps answering full pages. */
const MAX_PAGES = 1000

type PageReader<ItemT> = (offset: number, limit: number) => Promise<ItemT[]>

const readAll = async <ItemT>(readPage: PageReader<ItemT>, onProgress?: (loaded: number) => void): Promise<ItemT[]> => {
  const collected: ItemT[] = []

  for (let round = 0; round < MAX_PAGES; round += 1) {
    const page = await readPage(collected.length, PAGE_SIZE)
    collected.push(...page)
    onProgress?.(collected.length)
    if (page.length < PAGE_SIZE) {
      break
    }
  }

  return collected
}

/** Run `task` over every item with at most `concurrency` in flight. Failures are reported, not thrown. */
const forEachConcurrently = async <ItemT>(
  items: ItemT[],
  concurrency: number,
  task: (item: ItemT) => Promise<void>,
): Promise<void> => {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const item = items[next] as ItemT
      next += 1
      await task(item)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
}

export type { PageReader }
export { MAX_PAGES, PAGE_SIZE, forEachConcurrently, readAll }
