/**
 * Every call to the storage service (`/api/storage/...`): the upload endpoints (form batches and the
 * browser-driven multipart protocol), streamed content, temporary links, archives and removal.
 *
 * Uploads go through XMLHttpRequest rather than fetch: only XHR reports upload progress, and every upload
 * request can be aborted (pause / cancel). The engine that drives these calls lives in ./uploads.ts.
 */
import { downloadBlob, openLink, translate } from '@truth-platform/ui'
import { API_BASE, ApiError, api, buildUrl, send, type Query } from './client'

/* ------------------------------------------------------------------ shapes */

export type ArtifactKind = 'raw' | 'parsed' | 'parsed_additional' | 'additional'

export interface Artifact {
  id: string
  name: string
  /** Bucket key. */
  path: string
  descriptor: string
  kind: ArtifactKind
  suffix: string
  folder: string | null
  source: string | null
  size_bytes: number
  content_type: string
  checksum: string | null
  uploaded_by: string | null
  created_at: string | null
  updated_at: string | null
}

/** Where a pick of files is filed: who owns them, which role they play and in which folder. */
export interface UploadTarget {
  ownerKind: 'events' | 'entities' | string
  /** The event / entity id, or null for one that does not exist yet (the create wizard). */
  ownerId: string | null
  kind: ArtifactKind
  folder: string | null
  descriptor: string
}

export interface UploadSession {
  upload_id: string
  path: string
  part_size: number
  max_parts: number
}

export interface UploadPart {
  number: number
  etag: string
  size_bytes: number
}

export interface UploadStatus {
  upload_id: string
  path: string
  parts: UploadPart[]
}

export interface DownloadLink {
  url: string
  name: string
  content_type: string
  expires_at: string
}

export interface ArchiveEntry {
  path: string
  entry: string
}

export interface ArchiveDocument {
  entry: string
  content: string
}

export interface ArchiveManifest {
  entries: ArchiveEntry[]
  documents?: ArchiveDocument[]
  archive_name: string
}

export interface EntityArchiveSource {
  name: string
  typeName: string
  rawFiles: Artifact[]
  parsedFiles: Artifact[]
  parsedAdditionalFiles: Artifact[]
}

/* ------------------------------------------------------------------ constants */

export const STORAGE_PATH = '/storage/artifacts'
/** Uploads, parts and completions may take as long as a slow link needs. */
export const UPLOAD_TIMEOUT_MS = 600_000
const ARCHIVE_TIMEOUT_MS = 600_000
const PARTIAL_CONTENT = 206

/* ------------------------------------------------------------------ XHR transport */

/** Thrown when a request was aborted on purpose (pause or cancel), never shown to anybody. */
export class AbortedError extends Error {
  constructor() {
    super('aborted')
    this.name = 'AbortError'
  }
}

export const isAborted = (error: unknown): boolean =>
  error instanceof AbortedError || (error instanceof DOMException && error.name === 'AbortError')

interface XhrOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  query?: Query
  body?: XMLHttpRequestBodyInit | null
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
  /** Bytes of the body sent so far (cumulative, as the browser reports it). */
  onProgress?: (loaded: number) => void
}

function failure(xhr: XMLHttpRequest): ApiError {
  let message = translate('errors.generic')
  let error: string | null = null
  let details: Record<string, string> = {}
  try {
    const data = JSON.parse(xhr.responseText)
    if (typeof data?.detail === 'string' && data.detail) message = data.detail
    else if (Array.isArray(data?.detail) && data.detail[0]?.msg) message = String(data.detail[0].msg)
    error = data?.error ?? null
    details = data?.details ?? {}
  } catch {
    /* not JSON */
  }
  return new ApiError(message, xhr.status, error, details)
}

/** One request with upload progress and abort, answering the parsed JSON body (or the envelope as ApiError). */
export function xhrJson<T>(opts: XhrOptions): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (opts.signal?.aborted) return reject(new AbortedError())
    const xhr = new XMLHttpRequest()
    xhr.open(opts.method, buildUrl(opts.path, opts.query))
    xhr.timeout = opts.timeout ?? UPLOAD_TIMEOUT_MS
    for (const [k, v] of Object.entries(opts.headers ?? {})) xhr.setRequestHeader(k, v)
    if (opts.onProgress) xhr.upload.onprogress = (e) => opts.onProgress?.(e.loaded)
    const onAbort = () => xhr.abort()
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    const done = () => opts.signal?.removeEventListener('abort', onAbort)
    xhr.onload = () => {
      done()
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve((xhr.responseText ? JSON.parse(xhr.responseText) : undefined) as T)
        } catch {
          reject(new ApiError(translate('errors.generic'), xhr.status))
        }
      } else reject(failure(xhr))
    }
    xhr.onerror = () => {
      done()
      reject(new ApiError(translate('errors.network'), 0))
    }
    xhr.ontimeout = () => {
      done()
      reject(new ApiError(translate('errors.network'), 0))
    }
    xhr.onabort = () => {
      done()
      reject(new AbortedError())
    }
    xhr.send(opts.body ?? null)
  })
}

/* ------------------------------------------------------------------ upload endpoints */

/** `POST /storage/artifacts` - one batch of files as a multipart form; answers in the order sent. */
export function postArtifactBatch(
  files: File[],
  target: UploadTarget,
  onProgress?: (loaded: number) => void,
  signal?: AbortSignal,
): Promise<Artifact[]> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  form.append('owner_kind', target.ownerKind)
  form.append('kind', target.kind)
  form.append('descriptor', target.descriptor)
  if (target.ownerId !== null) form.append('owner_id', target.ownerId)
  if (target.folder !== null) form.append('folder', target.folder)
  return xhrJson<{ artifacts: Artifact[] }>({ method: 'POST', path: STORAGE_PATH, body: form, onProgress, signal }).then(
    (r) => r.artifacts,
  )
}

/** The descriptor both ends of a driven upload carry - everything about a file that is not its bytes. */
export const descriptorOf = (file: File, target: UploadTarget) => ({
  file_name: file.name,
  content_type: file.type.length > 0 ? file.type : 'application/octet-stream',
  owner_kind: target.ownerKind,
  owner_id: target.ownerId,
  kind: target.kind,
  folder: target.folder,
  descriptor: target.descriptor,
})

export const beginUpload = (file: File, target: UploadTarget, signal?: AbortSignal) =>
  api<UploadSession>(`${STORAGE_PATH}/uploads`, {
    method: 'POST',
    json: { ...descriptorOf(file, target), size_bytes: file.size },
    signal,
  })

export const readUploadStatus = (uploadId: string, path: string, signal?: AbortSignal) =>
  api<UploadStatus>(`${STORAGE_PATH}/uploads/${encodeURIComponent(uploadId)}`, { query: { path }, signal })

export const writeUploadPart = (
  uploadId: string,
  path: string,
  number: number,
  chunk: Blob,
  onProgress?: (loaded: number) => void,
  signal?: AbortSignal,
) =>
  xhrJson<UploadPart>({
    method: 'PUT',
    path: `${STORAGE_PATH}/uploads/${encodeURIComponent(uploadId)}/parts/${number}`,
    query: { path },
    body: chunk,
    headers: { 'Content-Type': 'application/octet-stream' },
    onProgress,
    signal,
  })

export const completeUpload = (file: File, target: UploadTarget, session: UploadSession, parts: UploadPart[]) =>
  api<Artifact>(`${STORAGE_PATH}/uploads/${encodeURIComponent(session.upload_id)}/complete`, {
    method: 'POST',
    json: { ...descriptorOf(file, target), path: session.path, parts: [...parts].sort((a, b) => a.number - b.number) },
    timeout: UPLOAD_TIMEOUT_MS,
  })

/** Give an open upload up (the bucket drops the parts). Never fails loudly - the service swallows errors too. */
export const abortUpload = (uploadId: string, path: string) =>
  api(`${STORAGE_PATH}/uploads/${encodeURIComponent(uploadId)}`, { method: 'DELETE', query: { path } }).catch(() => undefined)

/* ------------------------------------------------------------------ reading files back */

/** The address that streams one stored file through the service (img/iframe src, fetch, downloads). */
export function buildContentUrl(path: string, inline: boolean, name?: string): string {
  const parameters = new URLSearchParams({ path, inline: String(inline) })
  if (name) parameters.set('name', name)
  return `${API_BASE}${STORAGE_PATH}/content?${parameters.toString()}`
}

/** One window of a stored file. A whole-file answer (not 206) is refused - never pull a huge file by accident. */
export async function readArtifactWindow(path: string, start: number, end: number): Promise<string> {
  const response = await fetch(buildContentUrl(path, true), { headers: { Range: `bytes=${start}-${end}` } })
  if (!response.ok) throw new Error('The file could not be read')
  if (response.status !== PARTIAL_CONTENT) {
    throw new Error('The service answered with the whole file rather than the part that was asked for')
  }
  return response.text()
}

/** A download in a new tab, streamed through the service, saved under the name it was picked with. */
export function downloadArtifact(artifact: Pick<Artifact, 'path' | 'name'>): void {
  openLink(buildContentUrl(artifact.path, false, artifact.name))
}

/** A temporary bucket link - for server-side consumers (the URL may name an address browsers cannot reach). */
export const readDownloadLink = (path: string, name: string) =>
  api<DownloadLink>(`${STORAGE_PATH}/link`, { query: { path, name } })

export const deleteArtifact = (path: string) => api(STORAGE_PATH, { method: 'DELETE', query: { path } })

/**
 * Take back the files a save uploaded when the service then refused that save (4xx only: a timeout or a 5xx
 * may well have stored the record, and removing its files would break it). Fire and forget.
 */
export function discardRefusedUploads(error: unknown, artifacts: Artifact[]): void {
  const status = error instanceof ApiError ? error.status : undefined
  if (status === undefined || status < 400 || status >= 500 || artifacts.length === 0) return
  void Promise.allSettled(artifacts.map((a) => deleteArtifact(a.path)))
}

/* ------------------------------------------------------------------ archives */

/* eslint-disable-next-line no-control-regex */
const UNSAFE_PATH_CHARACTERS = /[\\/\u0000-\u001f\u007f]+/g
const STAMP_PATTERN = /[-:]|\.\d+(?=Z$)/g
const ROLE_FOLDERS = [
  { role: 'rawFiles', folder: 'raw_files' },
  { role: 'parsedFiles', folder: 'parsed_files' },
  { role: 'parsedAdditionalFiles', folder: 'parsed_additional_files' },
] as const

/** A name every unpacking tool accepts as one path segment (Unicode kept). */
export function safeSegment(value: string): string {
  const cleaned = value
    .normalize('NFC')
    .replace(UNSAFE_PATH_CHARACTERS, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
  return cleaned.length > 0 ? cleaned : 'unnamed'
}

function entriesFor(files: Artifact[], folder: string): ArchiveEntry[] {
  const seen = new Map<string, number>()
  return files.map((artifact) => {
    const name = safeSegment(artifact.name)
    const taken = seen.get(name) ?? 0
    seen.set(name, taken + 1)
    return { path: artifact.path, entry: `${folder}/${taken === 0 ? name : `${taken}-${name}`}` }
  })
}

export function buildEntityManifest(eventNumber: string, eventName: string, sources: EntityArchiveSource[]): ArchiveManifest {
  const entries: ArchiveEntry[] = []
  const seen = new Map<string, number>()
  for (const source of sources) {
    const base = `${safeSegment(source.typeName)}/${safeSegment(source.name)}`
    const taken = seen.get(base) ?? 0
    seen.set(base, taken + 1)
    const folder = taken === 0 ? base : `${base}-${taken}`
    for (const r of ROLE_FOLDERS) entries.push(...entriesFor(source[r.role], `${folder}/${r.folder}`))
  }
  const stem = sources.length === 1 ? sources[0].name : 'entities'
  const stamp = new Date().toISOString().replace(STAMP_PATTERN, '')
  return { entries, archive_name: `${safeSegment(`event-${eventNumber}-${eventName}-${stem}`)}-${stamp}.zip` }
}

export function toArchiveSources(
  entities: {
    name: string
    object_type: { name: string }
    raw_files: Artifact[]
    parsed_files: Artifact[]
    parsed_additional_files: Artifact[]
  }[],
): EntityArchiveSource[] {
  return entities.map((e) => ({
    name: e.name,
    typeName: e.object_type.name,
    rawFiles: e.raw_files,
    parsedFiles: e.parsed_files,
    parsedAdditionalFiles: e.parsed_additional_files,
  }))
}

/** `POST /storage/artifacts/archive` - the zip of what a manifest names, saved under its name. */
export async function downloadArchive(manifest: ArchiveManifest): Promise<void> {
  const res = await send(`${STORAGE_PATH}/archive`, { method: 'POST', json: manifest, timeout: ARCHIVE_TIMEOUT_MS })
  downloadBlob(await res.blob(), manifest.archive_name)
}

export async function downloadEntityArchive(eventNumber: string, eventName: string, sources: EntityArchiveSource[]): Promise<void> {
  const manifest = buildEntityManifest(eventNumber, eventName, sources)
  if (manifest.entries.length === 0) throw new Error('The picked entities carry no files to download')
  await downloadArchive(manifest)
}

/* ------------------------------------------------------------------ file identity */

/** How a file is addressed inside its owner: folder + name (the bucket key says nothing about it). */
export const artifactKey = (folder: string | null, name: string): string => `${folder ?? ''}/${name}`
export const keyOfArtifact = (a: Pick<Artifact, 'folder' | 'name'>): string => artifactKey(a.folder, a.name)

/** Picked files that would land on a stored file of the owner, or on each other. */
export function collidingNames(stored: Pick<Artifact, 'folder' | 'name'>[], picked: File[], folder: string | null): string[] {
  const taken = new Set(stored.map(keyOfArtifact))
  const clashing: string[] = []
  for (const file of picked) {
    const key = artifactKey(folder, file.name)
    if (taken.has(key)) clashing.push(file.name)
    else taken.add(key)
  }
  return [...new Set(clashing)]
}
