/** How a vocabulary value is drawn: its label in the page's language, its colour and its icon. */
import { hashedTone, localLabel, localName, toneOfColour, type BadgeTone } from '@truth-platform/ui'
import type { GridContext } from '../context'
import type { FilterOption } from '../types'

export interface ChipLook {
  label: string
  tone: BadgeTone
  icon: string
}

export type Palette = 'industry' | 'hashed' | 'neutral' | string | undefined

export function chipLook(value: string, palette: Palette, options: FilterOption[], ctx: GridContext): ChipLook {
  const option = options.find((o) => o.value === value)
  const member = ctx.taxonomy.find((m) => m.key === value)
  const label = option ? localLabel(option.label, option.labelHebrew) : member ? localName(member) : value
  const custom = (ctx.extra.toneFor as ((v: string, p: Palette) => BadgeTone | undefined) | undefined)?.(value, palette)
  if (custom) return { label, tone: custom, icon: '' }
  if (palette === 'industry') return { label, tone: toneOfColour(member?.color, value), icon: option?.icon || member?.icon || '' }
  if (palette === 'hashed') return { label, tone: hashedTone(value), icon: '' }
  return { label, tone: 'neutral', icon: '' }
}

export function readOptions(params: { colDef?: { filterParams?: unknown } | null }): FilterOption[] {
  const fp = params.colDef?.filterParams as { options?: FilterOption[] } | undefined
  return Array.isArray(fp?.options) ? fp!.options! : []
}

export function headerOf(params: { colDef?: { headerName?: string } | null }, fallback: string): string {
  return params.colDef?.headerName || fallback
}
