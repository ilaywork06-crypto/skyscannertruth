/**
 * Files as the inventory and the event page use them. The storage contract and the upload engine live in
 * ./storage and ./uploads (shared with the create wizard and the upload dialog); this module names what the
 * inventory screens need on top: content URLs, single downloads, entity archives and refused-save cleanup.
 */
import { translate } from '@truth-platform/ui'
import {
  buildContentUrl,
  buildEntityManifest,
  discardRefusedUploads,
  downloadArchive,
  downloadArtifact as streamDownload,
  type Artifact,
  type ArchiveManifest,
} from './storage'

export type { Artifact, ArtifactKind, ArchiveManifest, ArchiveEntry, ArchiveDocument } from './storage'
export { uploadArtifacts, type UploadOptions, type UploadProgress } from './uploads'
export { downloadArchive, UPLOAD_TIMEOUT_MS } from './storage'

/** The streamed bytes of a stored file, as a URL for <img>, <video>, <iframe>, fetch or a new tab. */
export function contentUrl(path: string, opts: { inline?: boolean; name?: string } = {}): string {
  return buildContentUrl(path, opts.inline ?? true, opts.name)
}

/** One file to the reader's disk, streamed through the storage service under its original name. */
export function downloadArtifact(artifact: Pick<Artifact, 'path' | 'name'>): void {
  streamDownload(artifact)
}

/** Removes uploads when the save they were for was refused (HTTP 4xx); keeps them on 5xx / network errors. */
export function discardIfRefused(error: unknown, artifacts: Artifact[]): void {
  discardRefusedUploads(error, artifacts)
}

export interface EntityArchiveSource {
  name: string
  typeName: string
  raw_files: Artifact[]
  parsed_files: Artifact[]
  parsed_additional_files: Artifact[]
}

export function entityArchiveManifest(eventNumber: string | number, eventName: string, sources: EntityArchiveSource[]): ArchiveManifest {
  return buildEntityManifest(
    String(eventNumber),
    eventName,
    sources.map((s) => ({ name: s.name, typeName: s.typeName, rawFiles: s.raw_files, parsedFiles: s.parsed_files, parsedAdditionalFiles: s.parsed_additional_files })),
  )
}

/** `<type>/<entity>[-n]/<role folder>/<file>` (spec §10.3); an empty pick is an error said in the page language. */
export async function downloadEntityArchive(eventNumber: string | number, eventName: string, sources: EntityArchiveSource[]): Promise<void> {
  const manifest = entityArchiveManifest(eventNumber, eventName, sources)
  if (!manifest.entries.length) throw new Error(translate('entities.noFiles'))
  await downloadArchive(manifest)
}
