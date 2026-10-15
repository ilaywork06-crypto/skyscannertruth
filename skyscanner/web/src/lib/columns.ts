/**
 * The service's column configuration as the inventory shows it (spec §4.11): `updated_at` left out, fields a
 * type asks for hidden until picked, headers in the page's language, the brief column held to its fifty
 * characters, the short vocabulary columns sized to their values, and the result drawn as an icon.
 */
import { hashText } from '@truth-platform/ui'
import { localiseColumns, type GeneratedColumn, type GeneratedGridConfiguration } from '@truth-platform/grid'
import type { EventType } from '@/api/taxonomy'

export const HIDDEN_COLUMNS = new Set(['updated_at'])
/** Sized to what they hold rather than stretched. */
export const AUTO_SIZED_COLUMNS = ['event_type_names', 'platforms', 'experiment_result']
/** Never offered in the column chooser. */
export const UNLISTED_COLUMNS = new Set(['expander', 'actions', 'open'])
export const RESULT_COLUMN = 'experiment_result'

export const isBriefColumn = (c: GeneratedColumn): boolean => typeof c.cellRendererParams?.maxChars === 'number'

/** `chars` average characters of the grid's font, in pixels (the brief column shows a full brief). */
export function measureChars(chars: number): number {
  if (typeof document === 'undefined') return chars * 8
  const probe = document.createElement('span')
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:13.5px;font-family:inherit;width:${chars}ch`
  document.body.appendChild(probe)
  const width = Math.ceil(probe.getBoundingClientRect().width)
  probe.remove()
  return width || chars * 8
}
const CELL_PADDING = 16 + 24

export function prepareInventoryConfiguration(config: GeneratedGridConfiguration, eventTypes: EventType[], hebrew: boolean): GeneratedGridConfiguration {
  const typeBound = new Set(eventTypes.flatMap((t) => t.custom_fields))
  const columns = config.columns
    .filter((c) => !HIDDEN_COLUMNS.has(c.colId))
    .map((c): GeneratedColumn => {
      let col: GeneratedColumn = c.dynamic && typeBound.has(c.colId) ? { ...c, hide: true } : c
      if (AUTO_SIZED_COLUMNS.includes(col.colId)) col = { ...col, flex: null, minWidth: 56 }
      if (col.colId === RESULT_COLUMN) col = { ...col, cellRenderer: 'ResultCellRenderer' }
      if (isBriefColumn(col)) {
        const width = measureChars(Number(col.cellRendererParams.maxChars)) + CELL_PADDING
        col = { ...col, wrapText: true, autoHeight: true, resizable: false, flex: null, width, minWidth: width, maxWidth: width }
      }
      return col
    })
  const localised = localiseColumns({ ...config, columns }, hebrew)
  // AG Grid is built once per configuration: any change in what it shows (headers, vocabularies) is a new one.
  return { ...localised, version: `${config.version}:${(hashText(JSON.stringify(localised.columns)) >>> 0).toString(36)}` }
}

/** The column configuration for one scope, headers localised (detail panels, the event page). */
export function localised(config: GeneratedGridConfiguration, hebrew: boolean): GeneratedGridConfiguration {
  return localiseColumns(config, hebrew)
}

/** Entity type display names from the `object_type_name` column's vocabulary (value = type name). */
export function entityTypeLabels(config: GeneratedGridConfiguration | null, hebrew: boolean): Map<string, string> {
  const out = new Map<string, string>()
  const col = config?.columns.find((c) => c.colId === 'object_type_name')
  for (const o of col?.filterOptions ?? []) out.set(o.value, hebrew && o.labelHebrew ? o.labelHebrew : o.label)
  return out
}
