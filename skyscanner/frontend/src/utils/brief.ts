/**
 * The title an event is headed with on its own page, worked out from what the event says about itself.
 *
 * The brief is written by a person and held to fifty characters; the title is never written by anybody. It
 * is put together out of the event's type, the platforms it ran on, its industry and its day, each of them
 * under the name the page is read in, so the head of the page says what happened, where and when - and the
 * brief underneath it says the rest in the words of whoever filed the event.
 */

import { joinIsolated } from '@truth-platform/core-ui'

/** How the parts of a title are joined. */
const PART_SEPARATOR = ' · '
const LIST_SEPARATOR = ' + '

/** Past this the platforms are counted rather than named, so a title stays one line somebody can read. */
const MAX_NAMED_PLATFORMS = 3

interface TitleParts {
  /** Names of the event types the event is filed under, in the language of the page. */
  typeNames: string[]
  /** Names of the platforms the event ran on, in the language of the page. */
  platformNames: string[]
  /** Name of the industry the event belongs to, in the language of the page. */
  industryName: string
  /** The day the event is dated by, already written out. */
  day: string
}

/**
 * Name the platforms an event ran on, counting them once there are more of them than a title can carry.
 */
const platformLabel = (names: string[]): string => {
  const named = names.filter((name) => name.length > 0)
  if (named.length <= MAX_NAMED_PLATFORMS) {
    return joinIsolated(named, LIST_SEPARATOR)
  }

  return `${joinIsolated(named.slice(0, MAX_NAMED_PLATFORMS), LIST_SEPARATOR)} +${named.length - MAX_NAMED_PLATFORMS}`
}

/**
 * Put the title of an event together, leaving out whatever the event does not say.
 *
 * The parts are names in two languages and a date, so each one is fenced off from the others; joined bare, a
 * Hebrew title with an English platform in the middle of it came out with its parts in the wrong order.
 */
const buildEventTitle = (parts: TitleParts): string =>
  joinIsolated(
    [joinIsolated(parts.typeNames, LIST_SEPARATOR), platformLabel(parts.platformNames), parts.industryName, parts.day],
    PART_SEPARATOR,
  )

export type { TitleParts }
export { buildEventTitle }
