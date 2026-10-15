/**
 * The colours of values. Only a parsed entity is "positive"; every other status, and every experiment result,
 * stays neutral (spec §4.12 StatusCellRenderer). Vocabulary chips follow the grid library's palettes.
 */
import { EMPTY_CONTEXT, chipLook, type ChipLook, type GridContext, type Palette, type TaxonomyItem } from '@truth-platform/grid'
import type { BadgeTone, } from '@truth-platform/ui'
import type { FilterOption } from '@truth-platform/grid'

export function statusTone(value: string, palette?: string): BadgeTone | undefined {
  if (palette === 'experiment') return 'neutral'
  return value === 'parsed' ? 'success' : undefined
}

export function contextFor(taxonomy: TaxonomyItem[]): GridContext {
  return { ...EMPTY_CONTEXT, taxonomy, extra: { toneFor: statusTone } }
}

/** How a vocabulary value is drawn outside AG Grid (attribute tables, compare, entity tables). */
export function lookOf(value: string, palette: Palette, options: FilterOption[], taxonomy: TaxonomyItem[]): ChipLook {
  const look = chipLook(value, palette, options, contextFor(taxonomy))
  // An industry with an icon is drawn neutral, its icon carrying the identity.
  if (palette === 'industry' && look.icon) return { ...look, tone: 'neutral' }
  return look
}
