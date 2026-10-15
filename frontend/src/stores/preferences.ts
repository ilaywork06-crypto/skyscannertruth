/**
 * Per-browser preferences: theme, sidebar, and where the reader left off.
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { readStored, writeStored } from '@/shared/utils/storage'

type ThemeMode = 'dark' | 'light'

const KEYS = {
  theme: 'truth.theme',
  rail: 'truth.sidebar.rail',
  lastIndustry: 'truth.industry.last',
  lastRegister: 'truth.register.last',
}

const preferredTheme = (): ThemeMode => {
  const stored = readStored(KEYS.theme)
  if (stored === 'dark' || stored === 'light') {
    return stored
  }
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export const usePreferences = defineStore('preferences', () => {
  const theme = ref<ThemeMode>(preferredTheme())
  const rail = ref<boolean>(readStored(KEYS.rail) === 'true')
  const lastIndustry = ref<string | null>(readStored(KEYS.lastIndustry))

  watch(theme, (value) => writeStored(KEYS.theme, value))
  watch(rail, (value) => writeStored(KEYS.rail, String(value)))
  watch(lastIndustry, (value) => writeStored(KEYS.lastIndustry, value))

  const toggleTheme = (): void => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  /** The address the register of an industry was left at in this tab, so "back" restores its view. */
  const rememberRegister = (industryId: string, fullPath: string): void =>
    writeStored(KEYS.lastRegister, JSON.stringify({ industryId, fullPath }), 'session')

  const registerPathFor = (industryId: string): string | null => {
    try {
      const stored = JSON.parse(readStored(KEYS.lastRegister, 'session') ?? 'null') as {
        industryId?: unknown
        fullPath?: unknown
      } | null

      return stored?.industryId === industryId && typeof stored.fullPath === 'string' ? stored.fullPath : null
    } catch {
      return null
    }
  }

  return { theme, rail, lastIndustry, toggleTheme, rememberRegister, registerPathFor }
})

export type { ThemeMode }
