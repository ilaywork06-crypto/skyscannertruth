/**
 * The industry pick of the inventory and the order of its tabs, both kept in this browser
 * (`skyscanner.industries.selected`, `skyscanner.industry-tabs.order` - the original keys).
 */
import { storage } from '@truth-platform/ui'

export const SELECTED_KEY = 'skyscanner.industries.selected'
export const ORDER_KEY = 'skyscanner.industry-tabs.order'

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

export const readStoredPick = (): string[] => strings(storage.json<unknown>(SELECTED_KEY, []))
export const writeStoredPick = (keys: string[]): void => storage.setJson(SELECTED_KEY, keys)

/** `?industries=a,b` → keys (trimmed, empties dropped); `null` when the parameter is absent. */
export function parsePickParam(value: unknown): string[] | null {
  if (value === undefined || value === null) return null
  const raw = Array.isArray(value) ? value.join(',') : String(value)
  return raw.split(',').map((k) => k.trim()).filter(Boolean)
}

export const readOrder = (): string[] => strings(storage.json<unknown>(ORDER_KEY, []))
export const writeOrder = (keys: string[]): void => storage.setJson(ORDER_KEY, keys)

/** Industries the stored order names first (in that order), then the rest in the service's order. */
export function orderIndustries<T extends { key: string }>(industries: T[], order: string[]): T[] {
  const byKey = new Map(industries.map((i) => [i.key, i]))
  const arranged = order.map((k) => byKey.get(k)).filter((i): i is T => !!i)
  const placed = new Set(arranged.map((i) => i.key))
  return [...arranged, ...industries.filter((i) => !placed.has(i.key))]
}

export function moveIndustry(keys: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= keys.length || to >= keys.length) return keys
  const moved = [...keys]
  const [carried] = moved.splice(from, 1)
  moved.splice(to, 0, carried)
  return moved
}
