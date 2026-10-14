/**
 * The reader's preferences - light/dark, colour theme, language, a collapsed sidebar - held once per page,
 * remembered in this browser, and applied to the document as they change.
 *
 * Each client names its own storage prefix, so the inventory and the register opened on one machine keep
 * their choices apart. The theme is also written out as finished CSS (`<prefix>.paint-light|dark`) so the
 * inline script in index.html can paint the right colours before the application has loaded.
 */
import { computed, reactive, watchEffect } from 'vue'
import { storage } from '../lib/storage'
import { ACCENTS, DEFAULT_ACCENT, themeCss, type Accent, type Mode } from './palette'

export type ThemeMode = Mode | 'system'
export type Language = 'en' | 'he'

interface State {
  prefix: string
  theme: ThemeMode
  accent: Accent
  language: Language
  sidebarCollapsed: boolean
  systemDark: boolean
}

const state = reactive<State>({
  prefix: 'app',
  theme: 'system',
  accent: DEFAULT_ACCENT,
  language: 'en',
  sidebarCollapsed: false,
  systemDark: false,
})

let installed = false

const key = (name: string) => `${state.prefix}.${name}`

/** Read the stored preferences and start applying them. Call once, before the app mounts. */
export function installPreferences(prefix: string, defaults: { language?: Language } = {}): void {
  if (installed) return
  installed = true
  state.prefix = prefix
  const theme = storage.get(key('theme'))
  state.theme = theme === 'light' || theme === 'dark' ? theme : 'system'
  const accent = storage.get(key('accent')) as Accent | null
  state.accent = accent && ACCENTS.includes(accent) ? accent : DEFAULT_ACCENT
  const lang = storage.get(key('lang'))
  state.language = lang === 'he' || lang === 'en' ? lang : (defaults.language ?? 'en')
  state.sidebarCollapsed = storage.get(key('sidebar')) === 'collapsed'

  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  state.systemDark = !!media?.matches
  // addEventListener on MediaQueryList arrived in Chrome 45 but Safari 14; addListener covers the rest.
  const onChange = (e: MediaQueryListEvent) => (state.systemDark = e.matches)
  if (media?.addEventListener) media.addEventListener('change', onChange)
  else media?.addListener?.(onChange)

  let style = document.getElementById('theme-tokens') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'theme-tokens'
    document.head.appendChild(style)
  }
  const sheet = style
  watchEffect(() => {
    const mode: Mode = isDark.value ? 'dark' : 'light'
    const css = themeCss(state.accent, mode)
    sheet.textContent = `:root { ${css} }`
    document.documentElement.classList.toggle('dark', mode === 'dark')
    // What the pre-paint script reads on the next load.
    storage.set(key('paint-light'), themeCss(state.accent, 'light'))
    storage.set(key('paint-dark'), themeCss(state.accent, 'dark'))
  })
  watchEffect(() => {
    document.documentElement.lang = state.language
    document.documentElement.dir = state.language === 'he' ? 'rtl' : 'ltr'
  })
}

const isDark = computed(() => state.theme === 'dark' || (state.theme === 'system' && state.systemDark))

export function usePreferences() {
  return {
    theme: computed(() => state.theme),
    accent: computed(() => state.accent),
    language: computed(() => state.language),
    direction: computed<'ltr' | 'rtl'>(() => (state.language === 'he' ? 'rtl' : 'ltr')),
    isDark,
    sidebarCollapsed: computed(() => state.sidebarCollapsed),
    setTheme(theme: ThemeMode) {
      state.theme = theme
      storage.set(key('theme'), theme)
    },
    setAccent(accent: Accent) {
      state.accent = accent
      storage.set(key('accent'), accent)
    },
    setLanguage(language: Language) {
      state.language = language
      storage.set(key('lang'), language)
    },
    setSidebarCollapsed(collapsed: boolean) {
      state.sidebarCollapsed = collapsed
      storage.set(key('sidebar'), collapsed ? 'collapsed' : null)
    },
  }
}

/**
 * The script each index.html inlines in its <head>, so the stored theme is painted before first render
 * (no flash of the wrong colours). `prefix` must match installPreferences.
 */
export function prePaintScript(prefix: string): string {
  return `try{var p=${JSON.stringify(prefix + '.')},s=localStorage,t=s.getItem(p+'theme')||'system',d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches),c=s.getItem(p+'paint-'+(d?'dark':'light'));if(d)document.documentElement.classList.add('dark');if(c){var e=document.createElement('style');e.id='theme-tokens';e.textContent=':root{'+c+'}';document.head.appendChild(e)}if(s.getItem(p+'lang')==='he'){document.documentElement.lang='he';document.documentElement.dir='rtl'}}catch(e){}`
}
