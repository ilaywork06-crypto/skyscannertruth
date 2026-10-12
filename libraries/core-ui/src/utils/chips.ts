/**
 * How one value of a vocabulary is drawn: under which name, with which icon, and in which colour.
 *
 * The grid's renderers and the plain tables draw the same values, so they ask the same question here. The
 * answer depends on the palette the column asked for:
 *
 *   - `industry` - a member of the vocabulary the rows are grouped by. One that has an icon is drawn with
 *     it and no colour; one without (a product that has no icons) keeps the colour it was registered with.
 *   - `hashed` - a value that is recognised by its colour, which is worked out from its own name so that
 *     nobody has to choose one and the same value always arrives in the same colour.
 *   - anything else - a neutral chip. Colour is kept for what it means something on.
 *
 * The name is the one the vocabulary gives the value, in the language of the page, and the stored value
 * itself where the vocabulary does not know it.
 */

import type { TaxonomyItem } from '../models/common'
import type { FilterOption } from '../models/grid'
import { localLabel, localName } from './names'
import { NEUTRAL_TOKEN, hashedToken, taxonomyToken } from './palette'

interface ChipLook {
  label: string
  icon: string
  token: string
}

/** The palette of a column whose values are the members of the vocabulary the rows are grouped by. */
const INDUSTRY_PALETTE = 'industry'

/** The palette of a column whose values each keep a colour of their own. */
const HASHED_PALETTE = 'hashed'

/** A vocabulary option as the wire carries it - the Hebrew label and the icon are both optional. */
type LabelledOption = FilterOption

/**
 * Work out how one value is drawn.
 */
const chipLook = (
  value: string,
  palette: string | undefined,
  options: LabelledOption[] = [],
  taxonomy: TaxonomyItem[] = [],
): ChipLook => {
  const option = options.find((candidate) => candidate.value === value)
  const member = taxonomy.find((candidate) => candidate.key === value)

  let label = value
  if (option !== undefined) {
    label = localLabel(option.label, option.labelHebrew)
  } else if (member !== undefined) {
    label = localName(member)
  }

  if (palette === INDUSTRY_PALETTE) {
    const icon = (option?.icon ?? '').length > 0 ? (option?.icon ?? '') : (member?.icon ?? '')

    return { label, icon, token: icon.length > 0 ? NEUTRAL_TOKEN : taxonomyToken(value, taxonomy) }
  }

  if (palette === HASHED_PALETTE) {
    return { label, icon: '', token: hashedToken(value) }
  }

  return { label, icon: '', token: NEUTRAL_TOKEN }
}

/**
 * Read the vocabulary a grid column carries, which the column parser hands to every cell as a filter param.
 */
const readColumnOptions = (filterParams: unknown): LabelledOption[] => {
  if (filterParams === null || typeof filterParams !== 'object') {
    return []
  }

  const options = (filterParams as { options?: unknown }).options

  return Array.isArray(options) ? (options as LabelledOption[]) : []
}

export type { ChipLook, LabelledOption }
export { HASHED_PALETTE, INDUSTRY_PALETTE, chipLook, readColumnOptions }
