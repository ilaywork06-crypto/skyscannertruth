/**
 * The rule that decides which declared event fields belong to an event: the ones its types ask for.
 *
 * An event type names the declared event fields it asks for by their key, and an event filed under several
 * types is asked for everything any one of them asks for. The create form, the edit form and the attributes
 * of an event all read that same rule here, so a field bound to one type is shown on that type's events only.
 */

import { isFilled } from '@truth-platform/core-ui'

import type { JsonValue } from '@/models/common'
import type { EventType } from '@/models/event'
import type { GeneratedColumn } from '@/models/grid'

/**
 * Collect the keys of the declared event fields the given types ask for.
 */
const askedFieldKeys = (types: EventType[]): Set<string> =>
  new Set(types.flatMap((candidate) => candidate.custom_fields))

/**
 * Keep the attribute columns that belong to an event.
 *
 * A declared field is kept when a type of the event asks for it. One the event already holds a value for is
 * kept too, so a value written before its field was bound to a type is never hidden. Everything that is not
 * a declared field - including a value stored under a key nobody declared - is left as it is.
 */
const eventAttributeColumnsFor = (
  columns: GeneratedColumn[],
  asked: Set<string>,
  values: Record<string, JsonValue> | undefined,
): GeneratedColumn[] =>
  columns.filter(
    (column) => !column.dynamic || column.discovered || asked.has(column.colId) || isFilled(values?.[column.colId]),
  )

export { askedFieldKeys, eventAttributeColumnsFor }
