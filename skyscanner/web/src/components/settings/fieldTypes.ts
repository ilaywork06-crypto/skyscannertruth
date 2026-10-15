/** Labels and rules of declared field types on the Schema page. */
import type { FieldType } from '@/api/taxonomy'

export type FieldSection = 'event' | 'own' | 'additional'

const TYPE_LABELS: Record<FieldType, string> = {
  string: 'STRING', text: 'TEXT', number: 'FLOAT', integer: 'INT', boolean: 'BOOL', date: 'DATE', datetime: 'DATETIME',
  enum: 'ENUM', json: 'JSON', coordinate: 'COORDINATE', file: 'FILE',
}
export const typeLabel = (type: FieldType): string => TYPE_LABELS[type] ?? String(type).toUpperCase()

/** FILE is not offered for new fields. */
export const FIELD_TYPE_OPTIONS: FieldType[] = ['string', 'text', 'number', 'integer', 'boolean', 'date', 'datetime', 'enum', 'json', 'coordinate']
export const LISTABLE_TYPES: ReadonlySet<FieldType> = new Set<FieldType>(['string', 'text', 'number', 'integer', 'date', 'datetime', 'enum'])
