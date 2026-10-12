/**
 * Which states of the inventory are painted in a colour, and which one.
 *
 * Colour is kept for what it says something on. An entity that finished parsing is the one state a reader
 * scans a table for, so `parsed` is green; every other state, the result of an activity and the status of
 * an event are neutral chips - the word says what they are, and a colour on top of it would only be noise.
 */

import { NEUTRAL_TOKEN } from '@truth-platform/core-ui'

import type { EntityStatus } from '@/models/common'

/** The one state that is painted: an entity whose files were parsed. */
const PARSED_STATUS: EntityStatus = 'parsed'

const POSITIVE_TOKEN = 'status-positive'

/**
 * Pick the colour token of a status chip, whichever kind of status it carries.
 */
const statusToken = (status: string): string => (status === PARSED_STATUS ? POSITIVE_TOKEN : NEUTRAL_TOKEN)

/**
 * Pick the colour token of a chip that a generated column asked for by palette name.
 *
 * The result of an activity is its own vocabulary - its "partial" is not a parsing state - so it is never
 * read as one, and it is neutral like every other value without a colour of its own.
 */
const paletteToken = (value: string, palette: string | undefined): string =>
  palette === 'experiment' ? NEUTRAL_TOKEN : statusToken(value)

export { paletteToken, statusToken }
