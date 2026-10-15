/**
 * The HTTP client: base address, timeout, and failures turned into `ApiError`s with a readable message.
 */

import axios, { type AxiosError } from 'axios'

interface ErrorBody {
  detail?: string | { msg?: string }[]
  error?: string
}

/** A failed request. `network` means the service could not be reached at all. */
class ApiError extends Error {
  readonly status: number | null
  readonly network: boolean

  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.network = status === null
  }
}

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL || '/api'
const REQUEST_TIMEOUT_MS = 60_000

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
})

/** The service's own reason when it gave one; validation lists are joined into one sentence. */
const readMessage = (error: AxiosError<ErrorBody>): string => {
  const body = error.response?.data
  const detail = body?.detail

  if (typeof detail === 'string' && detail.length > 0) {
    return detail
  }
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => item.msg ?? '').filter(Boolean)
    if (messages.length > 0) {
      return messages.join('; ')
    }
  }
  if (typeof body?.error === 'string' && body.error.length > 0) {
    return body.error
  }

  return error.message
}

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorBody>) => Promise.reject(new ApiError(readMessage(error), error.response?.status ?? null)),
)

export { API_BASE_URL, ApiError, http }
