/**
 * The upload engine: every picked file goes into the bucket, along two roads at once.
 *
 * - Ordinary files (< 64 MiB) travel as multipart form batches: files under 16 MiB grouped up to 8 per
 *   request, anything from 16 MiB on in a request of its own, at most 3 requests in the air.
 * - Large files (>= 64 MiB) are driven by the browser: an upload is opened, written part by part (4 parts in
 *   flight, each retried up to 4 times with doubling backoff) and completed; at most 2 such files at once.
 *   Open uploads are remembered in localStorage `skyscanner.uploads.open` (same key and shape as the original
 *   client, 24 h lifetime), so re-picking the same file - also after a reload - resumes from what the bucket
 *   says it already holds (verified with the status call, never trusted blindly).
 *
 * Results come back in pick order whatever order the requests landed in; any failure fails the whole pick.
 * An optional `UploadControl` pauses (in-flight requests are aborted and re-sent on resume - landed parts are
 * kept), resumes and cancels (open driven uploads are given up on the server and forgotten here).
 */
import { storage } from '@truth-platform/ui'
import {
  AbortedError,
  abortUpload,
  beginUpload,
  completeUpload,
  isAborted,
  postArtifactBatch,
  readUploadStatus,
  writeUploadPart,
  type Artifact,
  type UploadPart,
  type UploadSession,
  type UploadTarget,
} from './storage'

/* ------------------------------------------------------------------ limits (same as the original) */

export const UPLOAD_BATCH_SIZE = 8
export const UPLOAD_CONCURRENCY = 3
export const LARGE_FILE_BYTES = 16 * 1024 * 1024
export const DRIVEN_UPLOAD_BYTES = 64 * 1024 * 1024
export const PART_CONCURRENCY = 4
export const PART_ATTEMPTS = 4
export const RETRY_BACKOFF_MS = 500
export const DRIVEN_CONCURRENCY = 2
export const MOST_PARTS = 10_000
export const OPEN_UPLOADS_KEY = 'skyscanner.uploads.open'
export const OPEN_UPLOAD_LIFETIME_MS = 24 * 60 * 60 * 1000

/* ------------------------------------------------------------------ progress and control */

/** How much of one pick has landed. */
export interface UploadProgress {
  written: number
  total: number
  /** A file of the pick still being written. */
  name: string
}

export interface UploadOptions extends UploadTarget {
  /** The whole pick, whenever bytes land (also negative corrections when a request is re-sent). */
  onProgress?: (progress: UploadProgress) => void
  /** One file of the pick (index in the pick): bytes landed so far. */
  onFileProgress?: (index: number, written: number) => void
  /** One file of the pick is stored. */
  onFileDone?: (index: number, artifact: Artifact) => void
  /** One driven file resumed an upload left open earlier: this many bytes were already in the bucket. */
  onFileResumed?: (index: number, landedBytes: number) => void
  control?: UploadControl
}

export class UploadCancelledError extends Error {
  constructor() {
    super('The upload was cancelled')
    this.name = 'UploadCancelledError'
  }
}

/**
 * Pause / resume / cancel for one or more running picks. Pausing aborts the requests in the air (a part that
 * was half sent is sent again on resume); landed parts and finished files are kept.
 */
export class UploadControl {
  paused = false
  cancelled = false
  /** Stopped without giving up: open driven uploads stay remembered (and in the bucket) to be resumed. */
  keepOpen = false
  private controller = new AbortController()
  private waiters: (() => void)[] = []

  get signal(): AbortSignal {
    return this.controller.signal
  }

  pause(): void {
    if (this.paused || this.cancelled) return
    this.paused = true
    this.controller.abort()
  }

  resume(): void {
    if (!this.paused || this.cancelled) return
    this.paused = false
    this.controller = new AbortController()
    this.release()
  }

  /** Stop everything. `keepOpen` leaves large uploads resumable (closing the page); otherwise they are given up. */
  cancel(keepOpen = false): void {
    if (this.cancelled) return
    this.keepOpen = keepOpen
    this.cancelled = true
    this.paused = false
    this.controller.abort()
    this.release()
  }

  /** Waits while paused; throws once cancelled. */
  async gate(): Promise<void> {
    while (this.paused) await new Promise<void>((resolve) => this.waiters.push(resolve))
    if (this.cancelled) throw new UploadCancelledError()
  }

  private release(): void {
    const waiting = this.waiters
    this.waiters = []
    waiting.forEach((w) => w())
  }
}

/** Whether a failure is the control stopping things on purpose (pause: retry later; cancel: give up). */
function stoppedOnPurpose(error: unknown, control?: UploadControl): boolean {
  return !!control && isAborted(error) && (control.paused || control.cancelled)
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/* ------------------------------------------------------------------ remembered open uploads */

/** An upload opened and not finished; its parts are not remembered here - the bucket is the only account. */
export interface OpenUpload {
  uploadId: string
  path: string
  partSize: number
  /** `name|size|lastModified|ownerKind|ownerId|folder` */
  fingerprint: string
  openedAt: number
}

export const fingerprintOf = (file: File, target: Pick<UploadTarget, 'ownerKind' | 'ownerId' | 'folder'>): string =>
  [file.name, file.size, file.lastModified, target.ownerKind, target.ownerId ?? '', target.folder ?? ''].join('|')

/** The parts of a fingerprint (a file name may itself hold `|`, so it is read from the right). */
export function readFingerprint(fingerprint: string) {
  const parts = fingerprint.split('|')
  const [size, lastModified, ownerKind, ownerId, folder] = parts.slice(-5)
  return {
    name: parts.slice(0, -5).join('|'),
    size: Number(size),
    lastModified: Number(lastModified),
    ownerKind,
    ownerId: ownerId || null,
    folder: folder || null,
  }
}

export function readOpenUploads(): OpenUpload[] {
  const stored = storage.json<unknown>(OPEN_UPLOADS_KEY, [])
  if (!Array.isArray(stored)) return []
  const fresh = Date.now() - OPEN_UPLOAD_LIFETIME_MS
  return (stored as OpenUpload[]).filter(
    (e) => e && typeof e.fingerprint === 'string' && typeof e.uploadId === 'string' && e.openedAt > fresh,
  )
}

function writeOpenUploads(uploads: OpenUpload[]): void {
  storage.setJson(OPEN_UPLOADS_KEY, uploads)
}

function rememberUpload(upload: OpenUpload): void {
  writeOpenUploads([...readOpenUploads().filter((e) => e.fingerprint !== upload.fingerprint), upload])
}

export function forgetUpload(fingerprint: string): void {
  writeOpenUploads(readOpenUploads().filter((e) => e.fingerprint !== fingerprint))
}

/** The uploads this browser left open for one owner (e.g. one event), newest first. */
export function openUploadsFor(target: Pick<UploadTarget, 'ownerKind' | 'ownerId'>): OpenUpload[] {
  return readOpenUploads()
    .filter((e) => {
      const f = readFingerprint(e.fingerprint)
      return f.ownerKind === target.ownerKind && f.ownerId === (target.ownerId ?? null)
    })
    .sort((a, b) => b.openedAt - a.openedAt)
}

/** Give a remembered upload up: the bucket drops its parts and this browser forgets it. */
export async function discardOpenUpload(upload: OpenUpload): Promise<void> {
  forgetUpload(upload.fingerprint)
  await abortUpload(upload.uploadId, upload.path)
}

/* ------------------------------------------------------------------ driven (multipart) upload */

async function openDriven(
  file: File,
  target: UploadTarget,
  control?: UploadControl,
): Promise<{ session: UploadSession; landed: Map<number, UploadPart>; fingerprint: string }> {
  const fingerprint = fingerprintOf(file, target)
  const remembered = readOpenUploads().find((e) => e.fingerprint === fingerprint)
  if (remembered) {
    try {
      const status = await readUploadStatus(remembered.uploadId, remembered.path, control?.signal)
      return {
        session: { upload_id: remembered.uploadId, path: remembered.path, part_size: remembered.partSize, max_parts: MOST_PARTS },
        landed: new Map(status.parts.map((p) => [p.number, p])),
        fingerprint,
      }
    } catch (error) {
      if (stoppedOnPurpose(error, control)) throw error
      // The bucket swept it, finished it or never heard of it: open a fresh one.
      forgetUpload(fingerprint)
    }
  }
  const session = await beginUpload(file, target, control?.signal)
  rememberUpload({ uploadId: session.upload_id, path: session.path, partSize: session.part_size, fingerprint, openedAt: Date.now() })
  return { session, landed: new Map(), fingerprint }
}

/** Big enough for the file to fit in the parts the protocol allows. */
export const partSizeFor = (size: number, session: Pick<UploadSession, 'part_size' | 'max_parts'>): number =>
  Math.max(session.part_size, Math.ceil(size / Math.max(session.max_parts, 1)))

async function writePart(
  session: UploadSession,
  number: number,
  chunk: Blob,
  report: (inFlight: number) => void,
  control?: UploadControl,
): Promise<UploadPart> {
  let failures = 0
  for (;;) {
    await control?.gate()
    try {
      const part = await writeUploadPart(session.upload_id, session.path, number, chunk, report, control?.signal)
      report(0)
      return part
    } catch (error) {
      report(0)
      if (stoppedOnPurpose(error, control)) continue // gate() waits for resume or throws on cancel
      failures += 1
      if (failures >= PART_ATTEMPTS) {
        throw error instanceof Error ? error : new Error(`Part ${number} of the upload could not be written`)
      }
      await wait(RETRY_BACKOFF_MS * 2 ** (failures - 1))
    }
  }
}

async function uploadDriven(
  file: File,
  target: UploadTarget,
  setWritten: (bytes: number) => void,
  onResumed: (bytes: number) => void,
  control?: UploadControl,
): Promise<Artifact> {
  let opened: Awaited<ReturnType<typeof openDriven>> | null = null
  for (;;) {
    await control?.gate()
    try {
      opened = await openDriven(file, target, control)
      break
    } catch (error) {
      if (!stoppedOnPurpose(error, control)) throw error
    }
  }
  const { session, landed, fingerprint } = opened
  const partSize = partSizeFor(file.size, session)
  const count = Math.max(Math.ceil(file.size / partSize), 1)

  const parts = new Map<number, UploadPart>(landed)
  let landedBytes = 0
  landed.forEach((p) => (landedBytes += p.size_bytes))
  if (landedBytes > 0) onResumed(landedBytes)
  const inFlight = new Map<number, number>()
  const publish = () => {
    let flying = 0
    inFlight.forEach((v) => (flying += v))
    setWritten(Math.min(landedBytes + flying, file.size))
  }
  publish()

  let next = 1
  const worker = async () => {
    for (;;) {
      const number = next++
      if (number > count) return
      if (parts.has(number)) continue
      const from = (number - 1) * partSize
      const chunk = file.slice(from, Math.min(from + partSize, file.size))
      const written = await writePart(
        session,
        number,
        chunk,
        (loaded) => {
          inFlight.set(number, Math.min(loaded, chunk.size))
          publish()
        },
        control,
      )
      inFlight.delete(number)
      parts.set(number, written)
      landedBytes += chunk.size
      publish()
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(PART_CONCURRENCY, count) }, () => worker()))
    for (;;) {
      await control?.gate()
      try {
        const artifact = await completeUpload(file, target, session, [...parts.values()])
        forgetUpload(fingerprint)
        return artifact
      } catch (error) {
        if (!stoppedOnPurpose(error, control)) throw error
      }
    }
  } catch (error) {
    if (error instanceof UploadCancelledError && !control?.keepOpen) {
      // Cancelled on purpose: give the open upload up instead of leaving it to be resumed.
      forgetUpload(fingerprint)
      void abortUpload(session.upload_id, session.path)
    }
    // Otherwise it stays open (remembered), so picking the same file again continues it.
    throw error
  }
}

/* ------------------------------------------------------------------ batched (form) uploads */

interface PickedFile {
  file: File
  index: number
}

export function toUploadBatches<T extends { file: File }>(picked: T[]): T[][] {
  const batches: T[][] = []
  let current: T[] = []
  for (const entry of picked) {
    if (entry.file.size >= LARGE_FILE_BYTES) {
      if (current.length) batches.push(current)
      current = []
      batches.push([entry])
      continue
    }
    current.push(entry)
    if (current.length >= UPLOAD_BATCH_SIZE) {
      batches.push(current)
      current = []
    }
  }
  if (current.length) batches.push(current)
  return batches
}

async function uploadBatch(
  batch: PickedFile[],
  target: UploadTarget,
  setWritten: (index: number, bytes: number) => void,
  control?: UploadControl,
): Promise<Artifact[]> {
  // The form body is sent file by file, so its byte count is spread over the files in order.
  const spread = (loaded: number) => {
    let before = 0
    for (const entry of batch) {
      setWritten(entry.index, Math.max(0, Math.min(entry.file.size, loaded - before)))
      before += entry.file.size
    }
  }
  for (;;) {
    await control?.gate()
    try {
      const stored = await postArtifactBatch(batch.map((b) => b.file), target, spread, control?.signal)
      batch.forEach((entry) => setWritten(entry.index, entry.file.size))
      return stored
    } catch (error) {
      spread(0)
      if (!stoppedOnPurpose(error, control)) throw error
    }
  }
}

async function withConcurrency(tasks: (() => Promise<void>)[], limit: number, stopped: () => boolean): Promise<void> {
  let next = 0
  const worker = async () => {
    for (;;) {
      const index = next++
      if (index >= tasks.length || stopped()) return
      await tasks[index]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
}

/* ------------------------------------------------------------------ the pick */

/**
 * Write every picked file into the bucket and answer the artifact records, in pick order.
 * A failure of any file fails the whole pick (the caller re-picks; resumable uploads continue).
 */
export async function uploadArtifacts(files: File[], options: UploadOptions): Promise<Artifact[]> {
  if (files.length === 0) return []
  const { control } = options
  const target: UploadTarget = {
    ownerKind: options.ownerKind,
    ownerId: options.ownerId,
    kind: options.kind,
    folder: options.folder,
    descriptor: options.descriptor,
  }
  const picked: PickedFile[] = files.map((file, index) => ({ file, index }))
  const total = files.reduce((sum, f) => sum + f.size, 0)
  const written = new Array<number>(files.length).fill(0)
  const answers = new Array<Artifact | null>(files.length).fill(null)
  let failed = false

  const setWritten = (index: number, bytes: number) => {
    if (written[index] === bytes) return
    written[index] = bytes
    options.onFileProgress?.(index, bytes)
    const sum = written.reduce((a, b) => a + b, 0)
    const working = picked.find((p) => written[p.index] < p.file.size && answers[p.index] === null)
    options.onProgress?.({ written: Math.min(sum, total), total, name: working?.file.name ?? '' })
  }
  const store = (index: number, artifact: Artifact | null) => {
    answers[index] = artifact
    if (artifact) options.onFileDone?.(index, artifact)
  }
  options.onProgress?.({ written: 0, total, name: files[0].name })

  const driven = picked.filter((p) => p.file.size >= DRIVEN_UPLOAD_BYTES)
  const batches = toUploadBatches(picked.filter((p) => p.file.size < DRIVEN_UPLOAD_BYTES))
  const guard = async (task: () => Promise<void>) => {
    try {
      await task()
    } catch (error) {
      failed = true
      throw error
    }
  }

  await Promise.all([
    withConcurrency(
      driven.map((entry) => () =>
        guard(async () => {
          const artifact = await uploadDriven(
            entry.file,
            target,
            (bytes) => setWritten(entry.index, bytes),
            (bytes) => options.onFileResumed?.(entry.index, bytes),
            control,
          )
          setWritten(entry.index, entry.file.size)
          store(entry.index, artifact)
        }),
      ),
      DRIVEN_CONCURRENCY,
      () => failed,
    ),
    withConcurrency(
      batches.map((batch) => () =>
        guard(async () => {
          const stored = await uploadBatch(batch, target, setWritten, control)
          batch.forEach((entry, at) => store(entry.index, stored[at] ?? null))
        }),
      ),
      UPLOAD_CONCURRENCY,
      () => failed,
    ),
  ])
  if (control?.cancelled) throw new UploadCancelledError()
  return answers.filter((a): a is Artifact => a !== null)
}

export { AbortedError }
