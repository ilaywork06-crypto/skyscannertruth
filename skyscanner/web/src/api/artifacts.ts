/**
 * Files: their records, their bytes, archives of many, and the upload flow every form shares
 * (spec §7.7, §8.3, §10.2-10.3).
 *
 * Uploads: files under 64 MiB go as batched multipart forms (up to 8 small files per request, a 16 MiB+ file on
 * its own, 3 requests at a time); files of 64 MiB and more are driven part by part by the browser and resume
 * after a broken connection (remembered in localStorage `skyscanner.uploads.open` for 24 hours, verified with the
 * service before being trusted). The result comes back in pick order; any failure fails the whole pick.
 */
import { downloadBlob, openLink, storage } from '@truth-platform/ui'
import { API_BASE, ApiError, api, buildUrl, send } from './client'
import { translate } from '@truth-platform/ui'

export type ArtifactKind = 'raw' | 'parsed' | 'parsed_additional' | 'additional'

export interface Artifact {
  id: string
  name: string
  /** The bucket key. */
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

export interface DownloadLink {
  url: string
  name: string
  content_type: string
  expires_at: string
}

export const UPLOAD_TIMEOUT_MS = 600_000

/* ------------------------------------------------------------------ reading */

/** The streamed bytes of a stored file, as a URL for <img>, <iframe>, fetch or a new tab. */
export function contentUrl(path: string, opts: { inline?: boolean; name?: string } = {}): string {
  const params = new URLSearchParams({ path, inline: String(opts.inline ?? true) })
  if (opts.name) params.set('name', opts.name)
  return `${API_BASE}/storage/artifacts/content?${params.toString()}`
}

/**
 * One file to the reader's disk: streamed through the storage service (the bucket stays private) with its
 * original - possibly Hebrew - name.
 */
export function downloadArtifact(artifact: Pick<Artifact, 'path' | 'name'>): void {
  openLink(contentUrl(artifact.path, { inline: false, name: artifact.name }))
}

/** A time-limited link (for server-side consumers; the UI streams instead). */
export const readDownloadLink = (path: string, name?: string) =>
  api<DownloadLink>('/storage/artifacts/link', { query: { path, name } })

/** Detach-time cleanup only: the bytes of an upload whose save the service refused. Fire and forget. */
export function discardArtifacts(artifacts: Pick<Artifact, 'path'>[]): void {
  for (const a of artifacts) void send('/storage/artifacts', { method: 'DELETE', query: { path: a.path } }).catch(() => {})
}

/** Removes uploads when the save they were for was refused (HTTP 4xx); keeps them on 5xx/network errors. */
export function discardIfRefused(error: unknown, artifacts: Pick<Artifact, 'path'>[]): void {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) discardArtifacts(artifacts)
}

/* ------------------------------------------------------------------ archives */

export async function fetchArchive(manifest: ArchiveManifest): Promise<Blob> {
  const res = await send('/storage/artifacts/archive', { method: 'POST', json: manifest, timeout: UPLOAD_TIMEOUT_MS })
  return res.blob()
}

export async function downloadArchive(manifest: ArchiveManifest): Promise<void> {
  const blob = await fetchArchive(manifest)
  downloadBlob(blob, manifest.archive_name)
}

/** NFC; no slashes or control characters; whitespace collapsed; no leading/trailing dots or spaces. */
export function safeName(value: string): string {
  const cleaned = value
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '')
  return cleaned || 'unnamed'
}

/** `20261014T101530Z` - ISO time without separators and milliseconds. */
export function archiveStamp(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}/, '').replace(/[-:]/g, '')
}

export interface EntityArchiveSource {
  name: string
  typeName: string
  raw_files: Artifact[]
  parsed_files: Artifact[]
  parsed_additional_files: Artifact[]
}

const ROLE_FOLDERS = ['raw_files', 'parsed_files', 'parsed_additional_files'] as const

/** The manifest of entity files, laid out `<type>/<entity>[-n]/<role folder>/<file>` (spec §10.3). */
export function entityArchiveManifest(eventNumber: string | number, eventName: string, sources: EntityArchiveSource[]): ArchiveManifest {
  const entries: ArchiveEntry[] = []
  const usedEntity = new Map<string, number>()
  for (const s of sources) {
    const type = safeName(s.typeName)
    const base = `${type}/${safeName(s.name)}`
    const seen = usedEntity.get(base) ?? 0
    usedEntity.set(base, seen + 1)
    const dir = seen ? `${base}-${seen}` : base
    for (const role of ROLE_FOLDERS) {
      const names = new Map<string, number>()
      for (const file of s[role]) {
        const name = safeName(file.name)
        const n = names.get(name) ?? 0
        names.set(name, n + 1)
        entries.push({ path: file.path, entry: `${dir}/${role}/${n ? `${n}-` : ''}${name}` })
      }
    }
  }
  const stem = sources.length === 1 ? sources[0].name : 'entities'
  return { entries, archive_name: `${safeName(`event-${eventNumber}-${eventName}-${stem}`)}-${archiveStamp()}.zip` }
}

export async function downloadEntityArchive(eventNumber: string | number, eventName: string, sources: EntityArchiveSource[]): Promise<void> {
  const manifest = entityArchiveManifest(eventNumber, eventName, sources)
  if (!manifest.entries.length) throw new Error(translate('entities.noFiles'))
  await downloadArchive(manifest)
}

/* ------------------------------------------------------------------ uploads */

export interface UploadOptions {
  ownerKind: 'events' | 'entities'
  ownerId: string | null
  kind: ArtifactKind
  folder: string | null
  descriptor: string
  /** Bytes written so far for this pick, the pick's total, and a file still in progress. */
  onProgress?: (written: number, total: number, current: string) => void
}

export const MIB = 1024 * 1024
export const DRIVEN_THRESHOLD = 64 * MIB
export const SOLO_THRESHOLD = 16 * MIB
const BATCH_FILES = 8
const BATCH_CONCURRENCY = 3
const DRIVEN_CONCURRENCY = 2
const PART_CONCURRENCY = 4
const PART_ATTEMPTS = 4
const RESUME_KEY = 'skyscanner.uploads.open'
const RESUME_LIFETIME_MS = 24 * 3600 * 1000

interface OpenUpload {
  uploadId: string
  path: string
  partSize: number
  fingerprint: string
  openedAt: number
}
interface UploadedPart {
  number: number
  etag: string
  size_bytes: number
}

function readOpenUploads(): OpenUpload[] {
  const list = storage.json<unknown>(RESUME_KEY, [])
  if (!Array.isArray(list)) return []
  const now = Date.now()
  return (list as OpenUpload[]).filter((u) => u && typeof u.uploadId === 'string' && now - Number(u.openedAt) < RESUME_LIFETIME_MS)
}
function writeOpenUploads(list: OpenUpload[]): void {
  storage.setJson(RESUME_KEY, list)
}
function remember(entry: OpenUpload): void {
  writeOpenUploads([...readOpenUploads().filter((u) => u.fingerprint !== entry.fingerprint), entry])
}
function forget(fingerprint: string): void {
  writeOpenUploads(readOpenUploads().filter((u) => u.fingerprint !== fingerprint))
}

/** XHR, because fetch reports no upload progress. Errors become ApiError with the service's `detail`. */
function xhr<T>(method: string, path: string, body: XMLHttpRequestBodyInit, opts: { query?: Record<string, string>; contentType?: string; onProgress?: (loaded: number) => void }): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const req = new XMLHttpRequest()
    req.open(method, buildUrl(path, opts.query))
    req.timeout = UPLOAD_TIMEOUT_MS
    if (opts.contentType) req.setRequestHeader('Content-Type', opts.contentType)
    req.upload.onprogress = (e) => opts.onProgress?.(e.loaded)
    req.onerror = () => reject(new ApiError(translate('errors.network'), 0))
    req.ontimeout = () => reject(new ApiError(translate('errors.network'), 0))
    req.onload = () => {
      let data: unknown = null
      try {
        data = req.responseText ? JSON.parse(req.responseText) : null
      } catch {
        data = null
      }
      if (req.status >= 200 && req.status < 300) return resolve(data as T)
      const d = data as { detail?: unknown; error?: string; details?: Record<string, string> } | null
      const message = typeof d?.detail === 'string' && d.detail ? d.detail : translate('errors.generic')
      reject(new ApiError(message, req.status, d?.error ?? null, d?.details ?? {}))
    }
    req.send(body)
  })
}

/** Runs tasks with at most `limit` in flight; rejects on the first failure. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length)
  let next = 0
  let failed: unknown = null
  async function worker() {
    while (next < tasks.length && failed === null) {
      const i = next++
      try {
        out[i] = await tasks[i]()
      } catch (e) {
        failed = failed ?? e
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  if (failed !== null) throw failed
  return out
}

/** Small files share a request (≤ 8), a file of 16 MiB or more travels alone. */
export function planBatches(files: { size: number }[]): number[][] {
  const batches: number[][] = []
  let current: number[] = []
  files.forEach((f, i) => {
    if (f.size >= SOLO_THRESHOLD) batches.push([i])
    else {
      current.push(i)
      if (current.length === BATCH_FILES) {
        batches.push(current)
        current = []
      }
    }
  })
  if (current.length) batches.push(current)
  return batches
}

function descriptorFields(file: File, o: UploadOptions) {
  return {
    file_name: file.name,
    content_type: file.type || 'application/octet-stream',
    owner_kind: o.ownerKind,
    owner_id: o.ownerId,
    kind: o.kind,
    folder: o.folder,
    descriptor: o.descriptor,
  }
}

async function drivenUpload(file: File, o: UploadOptions, report: (bytes: number) => void): Promise<Artifact> {
  const fingerprint = [file.name, file.size, file.lastModified, o.ownerKind, o.ownerId ?? '', o.folder ?? ''].join('|')
  let open = readOpenUploads().find((u) => u.fingerprint === fingerprint) ?? null
  let landed: UploadedPart[] = []
  let maxParts = 10_000
  if (open) {
    try {
      const status = await api<{ upload_id: string; path: string; parts: UploadedPart[] }>(`/storage/artifacts/uploads/${encodeURIComponent(open.uploadId)}`, { query: { path: open.path } })
      landed = status.parts ?? []
    } catch {
      forget(fingerprint)
      open = null
    }
  }
  if (!open) {
    const started = await api<{ upload_id: string; path: string; part_size: number; max_parts: number }>('/storage/artifacts/uploads', {
      method: 'POST',
      json: { ...descriptorFields(file, o), size_bytes: file.size },
    })
    maxParts = started.max_parts || 10_000
    open = { uploadId: started.upload_id, path: started.path, partSize: started.part_size, fingerprint, openedAt: Date.now() }
    remember(open)
  }
  const session = open
  const partSize = Math.max(session.partSize, Math.ceil(file.size / maxParts))
  const count = Math.max(1, Math.ceil(file.size / partSize))
  const done = new Map<number, UploadedPart>(landed.map((p) => [p.number, p]))
  report([...done.values()].reduce((s, p) => s + p.size_bytes, 0))
  const tasks: (() => Promise<UploadedPart>)[] = []
  for (let n = 1; n <= count; n++) {
    const have = done.get(n)
    if (have) {
      tasks.push(async () => have)
      continue
    }
    const blob = file.slice((n - 1) * partSize, Math.min(file.size, n * partSize))
    tasks.push(async () => {
      let lastError: unknown = null
      for (let attempt = 0; attempt < PART_ATTEMPTS; attempt++) {
        let sent = 0
        try {
          const part = await xhr<UploadedPart>('PUT', `/storage/artifacts/uploads/${encodeURIComponent(session.uploadId)}/parts/${n}`, blob, {
            query: { path: session.path },
            contentType: 'application/octet-stream',
            onProgress: (loaded) => {
              report(loaded - sent)
              sent = loaded
            },
          })
          return part
        } catch (e) {
          report(-sent)
          lastError = e
          await new Promise((r) => setTimeout(r, 500 * 2 ** attempt))
        }
      }
      throw lastError
    })
  }
  const parts = await pool(tasks, PART_CONCURRENCY)
  const artifact = await api<Artifact>(`/storage/artifacts/uploads/${encodeURIComponent(session.uploadId)}/complete`, {
    method: 'POST',
    json: { ...descriptorFields(file, o), path: session.path, parts: parts.map((p) => ({ number: p.number, etag: p.etag, size_bytes: p.size_bytes })) },
    timeout: UPLOAD_TIMEOUT_MS,
  })
  forget(fingerprint)
  return artifact
}

/** Uploads one pick of files with the given role; artifacts come back in pick order. */
export async function uploadArtifacts(files: File[], o: UploadOptions): Promise<Artifact[]> {
  if (!files.length) return []
  const total = files.reduce((s, f) => s + f.size, 0)
  let written = 0
  const progress = new Map<number, number>()
  const current = () => {
    const i = files.findIndex((f, k) => (progress.get(k) ?? 0) < f.size)
    return i === -1 ? '' : files[i].name
  }
  const bump = (indexes: number[], bytes: number) => {
    written = Math.max(0, Math.min(total, written + bytes))
    // Spread the batch's bytes over its files in order, so "the file still in progress" stays meaningful.
    let left = bytes
    for (const i of indexes) {
      if (left <= 0) break
      const have = progress.get(i) ?? 0
      const take = Math.min(files[i].size - have, left)
      progress.set(i, have + take)
      left -= take
    }
    o.onProgress?.(written, total, current())
  }
  o.onProgress?.(0, total, files[0]?.name ?? '')

  const out: Artifact[] = new Array(files.length)
  const small: { file: File; index: number }[] = []
  const large: { file: File; index: number }[] = []
  files.forEach((file, index) => (file.size >= DRIVEN_THRESHOLD ? large : small).push({ file, index }))

  const batchTasks = planBatches(small.map((s) => s.file)).map((batch) => async () => {
    const members = batch.map((b) => small[b])
    const form = new FormData()
    for (const m of members) form.append('files', m.file, m.file.name)
    form.append('owner_kind', o.ownerKind)
    form.append('kind', o.kind)
    form.append('descriptor', o.descriptor)
    if (o.ownerId) form.append('owner_id', o.ownerId)
    if (o.folder) form.append('folder', o.folder)
    let sent = 0
    const res = await xhr<{ artifacts: Artifact[] }>('POST', '/storage/artifacts', form, {
      onProgress: (loaded) => {
        const batchBytes = members.reduce((s, m) => s + m.file.size, 0)
        const clamped = Math.min(loaded, batchBytes)
        bump(members.map((m) => m.index), clamped - sent)
        sent = clamped
      },
    })
    members.forEach((m, k) => (out[m.index] = res.artifacts[k]))
  })
  const drivenTasks = large.map((l) => async () => {
    out[l.index] = await drivenUpload(l.file, o, (bytes) => bump([l.index], bytes))
  })
  await Promise.all([pool(batchTasks, BATCH_CONCURRENCY), pool(drivenTasks, DRIVEN_CONCURRENCY)])
  return out
}

/** The bar is shown only for picks totalling 8 MiB or more. */
export const PROGRESS_THRESHOLD = 8 * MIB
