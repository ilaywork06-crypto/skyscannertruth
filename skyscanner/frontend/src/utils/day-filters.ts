/**
 * Pinning the days a date filter picked to the time zone of the reader who picked them.
 *
 * A date filter sends a day as midnight and nothing else, and the service reads such a day in UTC. East of
 * Greenwich that is not the day on screen: a moment of 22:00 UTC is shown under the next day, and a date picked
 * in a form is stored as the reader's own midnight - the evening before, in UTC. Naming the offset of that day
 * is what makes the filter find exactly the rows the table shows under it.
 */

import type { JsonValue } from '@/models/common'
import type { FilterCondition } from '@/models/query'

/** A day exactly as a date filter writes it, with no zone of its own yet. */
const UNZONED_DAY = /^(\d{4})-(\d{2})-(\d{2})[ T]00:00:00$/

const MINUTES_PER_HOUR = 60

/**
 * Write the offset of the reader's zone on a given day, the way an ISO moment carries it.
 */
const offsetOf = (year: number, month: number, day: number): string => {
  /* The runtime counts months from zero, and the offset of a day is the one in force at its own midnight. */
  const minutes = -new Date(year, month - 1, day).getTimezoneOffset()
  const sign = minutes < 0 ? '-' : '+'
  const hours = String(Math.floor(Math.abs(minutes) / MINUTES_PER_HOUR)).padStart(2, '0')
  const rest = String(Math.abs(minutes) % MINUTES_PER_HOUR).padStart(2, '0')

  return `${sign}${hours}:${rest}`
}

/** Give one value its zone when it is a day, and leave every other value exactly as it was. */
const zoneDay = (value: JsonValue): JsonValue => {
  if (typeof value !== 'string') {
    return value
  }

  const match = UNZONED_DAY.exec(value.trim())
  if (match === null) {
    return value
  }

  return `${value.trim()}${offsetOf(Number(match[1]), Number(match[2]), Number(match[3]))}`
}

/**
 * Pin every day the conditions carry to the reader's zone, just before they are sent.
 *
 * Only the request is changed: a saved view keeps its days unzoned, so it reads as the same days wherever it
 * is opened.
 */
const withLocalDays = (conditions: FilterCondition[]): FilterCondition[] =>
  conditions.map((condition) => ({
    ...condition,
    value: zoneDay(condition.value),
    values: condition.values.map(zoneDay),
  }))

export { withLocalDays }
