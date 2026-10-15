/**
 * The one way the register talks to the assumptions API: `VITE_API_BASE_URL` (default `/api`, which the dev
 * server and nginx forward to the API with the prefix stripped), JSON both ways, a 60 s ceiling per request.
 * Every failure becomes an `ApiError` worded by the service's own envelope.
 */
import { translate } from '@truth-platform/ui'

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'
const TIMEOUT_MS = 60_000

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

interface ErrorBody {
  detail?: string | { msg?: string }[]
  error?: string
}

/**
 * The service's own words for a failure: `detail` when it is a sentence, the `msg` of each complaint of a
 * validation list joined with "; ", then `error`; otherwise the transport's status text or the generic phrase.
 */
export function readErrorMessage(body: unknown, statusText: string): string {
  const b = (body && typeof body === 'object' ? body : {}) as ErrorBody
  if (typeof b.detail === 'string' && b.detail.length > 0) return b.detail
  if (Array.isArray(b.detail)) {
    const messages = b.detail.map((d) => (d && typeof d.msg === 'string' ? d.msg : '')).filter((m) => m.length > 0)
    if (messages.length) return messages.join('; ')
  }
  if (typeof b.error === 'string' && b.error.length > 0) return b.error
  return statusText || translate('errors.generic')
}

export type Query = Record<string, string | number | null | undefined>

export function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) if (v !== null && v !== undefined && v !== '') params.set(k, String(v))
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`
}

async function request<T>(method: 'GET' | 'POST', path: string, init: { query?: Query; json?: unknown } = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(buildUrl(path, init.query), {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
      signal: controller.signal,
    })
  } catch {
    throw new ApiError(translate('errors.network'), 0)
  } finally {
    clearTimeout(timer)
  }
  const text = await res.text().catch(() => '')
  let body: unknown = undefined
  try {
    body = text ? JSON.parse(text) : undefined
  } catch {
    body = undefined
  }
  if (!res.ok) {
    // A proxy answering for a service that is down says 502/503/504 with no envelope: that is "not reached".
    if (body === undefined && [502, 503, 504].includes(res.status)) throw new ApiError(translate('errors.network'), res.status)
    throw new ApiError(readErrorMessage(body, res.statusText), res.status)
  }
  return body as T
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, json: unknown) => request<T>('POST', path, { json }),
}
