import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { installPreferences, installRuntimeShims, registerTranslations, storage } from '@truth-platform/ui'
import { createApp } from 'vue'
import App from './App.vue'
import { DICTIONARY } from './i18n/dictionary'
import { router } from './router'
import './styles.css'

// Old browsers first: component libraries call methods (findLast, at…) older Chromes do not have.
installRuntimeShims()

// Carry the original client's preferences over once: `truth.theme` held truthDark/truthLight, `ui.language` en/he.
const oldTheme = storage.get('truth.theme')
if (oldTheme === 'truthDark' || oldTheme === 'truthLight') storage.set('truth.theme', oldTheme === 'truthDark' ? 'dark' : 'light')
const oldLanguage = storage.get('ui.language')
if (!storage.get('truth.lang') && (oldLanguage === 'he' || oldLanguage === 'en')) storage.set('truth.lang', oldLanguage)

installPreferences('truth')
registerTranslations(DICTIONARY)

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 } } })
createApp(App).use(router).use(VueQueryPlugin, { queryClient }).mount('#app')
