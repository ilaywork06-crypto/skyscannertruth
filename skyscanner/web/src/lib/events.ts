/**
 * Rules about one event that several screens share: its generated title, which declared fields belong to it,
 * the attribute columns shown for it, and the identity of its files.
 */
import { humanizeKey, isFilled, joinIsolated } from '@truth-platform/ui'
import type { GeneratedColumn, GridRow, JsonValue } from '@truth-platform/grid'
import type { Artifact } from '@/api/artifacts'
import type { EventType } from '@/api/taxonomy'

/* ------------------------------------------------------------------ title */

const PART_SEPARATOR = ' · '
const LIST_SEPARATOR = ' + '
const MAX_NAMED_PLATFORMS = 3

export interface TitleParts {
  typeNames: string[]
  platformNames: string[]
  industryName: string
  day: string
}

function platformLabel(names: string[]): string {
  const named = names.filter(Boolean)
  if (named.length <= MAX_NAMED_PLATFORMS) return joinIsolated(named, LIST_SEPARATOR)
  return `${joinIsolated(named.slice(0, MAX_NAMED_PLATFORMS), LIST_SEPARATOR)} +${named.length - MAX_NAMED_PLATFORMS}`
}

/** "types · platforms · industry · day" - each part fenced off so mixed languages keep their order. */
export function buildEventTitle(parts: TitleParts): string {
  return joinIsolated([joinIsolated(parts.typeNames, LIST_SEPARATOR), platformLabel(parts.platformNames), parts.industryName, parts.day], PART_SEPARATOR)
}

/* ------------------------------------------------------------------ fields of an event */

export const askedFieldKeys = (types: EventType[]): Set<string> => new Set(types.flatMap((t) => t.custom_fields))
export const askedBuiltIns = (types: EventType[]): Set<string> => new Set(types.flatMap((t) => t.fields))

/**
 * The attribute columns that belong to an event: not a declared field, discovered, asked by one of its types, or
 * already holding a value (a value is never hidden).
 */
export function eventAttributeColumnsFor(columns: GeneratedColumn[], asked: Set<string>, values: Record<string, JsonValue> | undefined): GeneratedColumn[] {
  return columns.filter((c) => !c.dynamic || c.discovered || asked.has(c.colId) || isFilled(values?.[c.colId]))
}

/** A synthetic column for a value stored under a key no declaration names. */
export function undeclaredColumn(key: string): GeneratedColumn {
  return {
    colId: key, field: `data.${key}`, headerName: humanizeKey(key), headerNameHebrew: '', sortable: false, filter: false,
    floatingFilter: false, resizable: true, hide: false, editable: false, flex: 1, minWidth: 120, maxWidth: null, width: null,
    pinned: null, cellRenderer: 'TextCellRenderer', cellRendererParams: {}, cellDataType: false, headerClass: null,
    cellClass: null, autoHeight: false, fieldType: 'string', dynamic: true, discovered: true, industry: null,
    filterOptions: [], quickFilter: false,
  }
}

/** Every dynamic column, plus one for each stored key nobody declared. */
export function attributeColumns(columns: GeneratedColumn[], row: GridRow | null | undefined): GeneratedColumn[] {
  const dynamic = columns.filter((c) => c.dynamic)
  const known = new Set(dynamic.map((c) => c.colId))
  const data = (row?.data ?? {}) as Record<string, JsonValue>
  const extra = Object.keys(data).filter((k) => !known.has(k)).map(undeclaredColumn)
  return [...dynamic, ...extra]
}

/* ------------------------------------------------------------------ files */

export const artifactKey = (folder: string | null, name: string): string => `${folder ?? ''}/${name}`
export const keyOfArtifact = (a: Pick<Artifact, 'folder' | 'name'>): string => artifactKey(a.folder, a.name)

/** Picked files that would land on top of a kept file, or on each other. */
export function collidingNames(stored: Pick<Artifact, 'folder' | 'name'>[], picked: File[], folder: string | null): string[] {
  const taken = new Set(stored.map(keyOfArtifact))
  const clashing: string[] = []
  for (const f of picked) {
    const key = artifactKey(folder, f.name)
    if (taken.has(key)) clashing.push(f.name)
    else taken.add(key)
  }
  return [...new Set(clashing)]
}

export function collisionMessage(stored: Pick<Artifact, 'folder' | 'name'>[], picked: File[], folder: string | null, label: string): string {
  const clashing = collidingNames(stored, picked, folder)
  return clashing.length ? `${label} already holds ${clashing.join(', ')}. Remove the stored copy first, or rename the file.` : ''
}

/** The artifacts in a row value (tolerates anything that is not a list of records). */
export function readArtifacts(value: unknown): Artifact[] {
  return Array.isArray(value) ? (value.filter((v) => v && typeof v === 'object' && 'path' in (v as object)) as Artifact[]) : []
}
