/**
 * Reading a whole listing out of an API that only offers a window onto it: every listing takes offset/limit,
 * answers a bare array and never says how many rows there are. So it is asked again until a page comes back
 * short (an exact multiple of the page size costs one extra, empty, request), with a ceiling on the rounds.
 */
export const PAGE_SIZE = 100
export const MAX_PAGES = 1000

export async function readAll<T>(
  readPage: (offset: number, limit: number) => Promise<T[]>,
  onProgress?: (loaded: number) => void,
): Promise<T[]> {
  const collected: T[] = []
  for (let round = 0; round < MAX_PAGES; round += 1) {
    const page = await readPage(collected.length, PAGE_SIZE)
    collected.push(...page)
    onProgress?.(collected.length)
    if (page.length < PAGE_SIZE) break
  }
  return collected
}
