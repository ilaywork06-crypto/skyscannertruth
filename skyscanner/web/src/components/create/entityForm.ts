/** The value of the entity sub-form (create wizard, add / edit entity dialogs). */
import type { EntityStatus } from '@/api/create'
import type { FieldType, JsonValue } from '@/api/taxonomy'

export interface EntityFormValue {
  typeKey: string | null
  name: string
  module: string | null
  codeVersion: string
  status: EntityStatus
  notes: string
  values: Record<string, JsonValue>
  valueTypes: Record<string, FieldType>
  rawFiles: File[]
  parsedFiles: File[]
  parsedAdditionalFiles: File[]
}

export const ENTITY_STATUS_OPTIONS: EntityStatus[] = ['raw', 'parsing', 'partially_parsed', 'parsed', 'failed']
/** Statuses that need parsed files. */
export const PARSED_STATUSES: EntityStatus[] = ['parsed', 'partially_parsed']

export const emptyEntityForm = (): EntityFormValue => ({
  typeKey: null,
  name: '',
  module: null,
  codeVersion: '',
  status: 'raw',
  notes: '',
  values: {},
  valueTypes: {},
  rawFiles: [],
  parsedFiles: [],
  parsedAdditionalFiles: [],
})

/** A form in a comparable shape (files by name and size), for dirty checks. */
export const describeEntityForm = (form: EntityFormValue) => ({
  ...form,
  rawFiles: form.rawFiles.map((f) => `${f.name}:${f.size}`),
  parsedFiles: form.parsedFiles.map((f) => `${f.name}:${f.size}`),
  parsedAdditionalFiles: form.parsedAdditionalFiles.map((f) => `${f.name}:${f.size}`),
})
