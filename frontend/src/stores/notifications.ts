/**
 * Toast notifications.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

import { errorMessage } from '@/shared/utils/errors'

type Tone = 'success' | 'info' | 'warning' | 'error'

interface Toast {
  id: number
  text: string
  tone: Tone
}

const LIFETIME_MS = 4500

export const useNotifications = defineStore('notifications', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 1

  const dismiss = (id: number): void => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  const notify = (text: string, tone: Tone = 'info'): void => {
    const id = nextId
    nextId += 1
    toasts.value = [...toasts.value, { id, text, tone }]
    setTimeout(() => dismiss(id), tone === 'error' ? LIFETIME_MS * 2 : LIFETIME_MS)
  }

  const reportError = (error: unknown): void => notify(errorMessage(error), 'error')

  return { toasts, notify, reportError, dismiss }
})

export type { Toast, Tone }
