/**
 * The one way the client talks to the services. A failure becomes an `ApiError` carrying the service's own
 * sentence (`detail` of the error envelope), or a network/generic message in the page language.
 */
import { translate } from '@truth-platform/ui'

export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'
const TIMEOUT_MS = 60_000

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly error: string | null = null,
    readonly details: Record<string, string> = {},
  ) {
    super(message)
  }
}

export type Query = Record<string, string | number | boolean | null | undefined | (string | number)[]>

export function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === null || v === undefined || v === '') continue
    if (Array.isArray(v)) v.forEach((x) => params.append(k, String(x)))
    else params.set(k, String(v))
  }
  const qs = params.toString()
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Query
  json?: unknown
  body?: BodyInit
  headers?: Record<string, string>
  signal?: AbortSignal
  timeout?: number
}

export async function send(path: string, opts: Options = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeout ?? TIMEOUT_MS)
  opts.signal?.addEventListener('abort', () => controller.abort())
  const headers: Record<string, string> = { ...opts.headers }
  let body = opts.body
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  }
  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), { method: opts.method ?? 'GET', headers, body, signal: controller.signal })
  } catch {
    throw new ApiError(translate('errors.network'), 0)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    let message = translate('errors.generic')
    let error: string | null = null
    let details: Record<string, string> = {}
    try {
      const data = await res.json()
      if (typeof data?.detail === 'string' && data.detail) message = data.detail
      else if (Array.isArray(data?.detail) && data.detail[0]?.msg) message = String(data.detail[0].msg)
      error = data?.error ?? null
      details = data?.details ?? {}
    } catch {
      /* not JSON */
    }
    throw new ApiError(message, res.status, error, details)
  }
  return res
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const res = await send(path, opts)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}
