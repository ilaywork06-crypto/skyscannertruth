/**
 * Keeping text of two directions readable when it is written into one line.
 *
 * The browser orders a line as a whole: an English name inside a Hebrew sentence pulls the punctuation and the
 * numbers beside it over to its own side, and a list of Hebrew and English names joined by commas comes out
 * with its commas in the wrong places. Fencing each piece off with the invisible isolate marks (FIRST STRONG
 * ISOLATE and POP DIRECTIONAL ISOLATE) lets it take its direction from its own first letter while the line
 * around it treats it as one neutral block that stays where it was written.
 */

const ISOLATE_START = '\u2068'
const ISOLATE_END = '\u2069'

/** A letter that has a direction of its own: Latin, Greek, Cyrillic, Hebrew or Arabic. */
const STRONG_LETTER = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF]/

/**
 * Fence one piece of text off from the line it is written into.
 */
const isolate = (text: string): string => (text.length === 0 ? text : `${ISOLATE_START}${text}${ISOLATE_END}`)

/**
 * Join pieces of text into one line, each of them fenced off from the others.
 */
const joinIsolated = (pieces: string[], separator: string = ', '): string =>
  pieces
    .filter((piece) => piece.length > 0)
    .map(isolate)
    .join(separator)

/**
 * The direction a value shown on its own should be given: its own when it holds a letter, the surrounding one
 * when it does not.
 *
 * A number, a date or a dash has no direction, and `dir="auto"` would read that as left to right - a column of
 * numbers in a Hebrew table would then line up on the wrong side of it. Such a value is left to follow its
 * column instead.
 */
const valueDirection = (text: string): 'auto' | undefined => (STRONG_LETTER.test(text) ? 'auto' : undefined)

export { isolate, joinIsolated, valueDirection }
