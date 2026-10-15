import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { configureMapTiles, installPreferences, installRuntimeShims, registerTranslations } from '@truth-platform/ui'
import { createApp } from 'vue'
import App from './App.vue'
import { DICTIONARY } from './i18n/dictionary'
import { router } from './router'
import './styles.css'

// Old browsers first: component libraries call methods (findLast, at…) older Chromes do not have.
installRuntimeShims()
installPreferences('skyscanner')
registerTranslations(DICTIONARY)
configureMapTiles({
  url: (import.meta.env.VITE_MAP_TILE_URL as string | undefined) ?? '',
  attribution: (import.meta.env.VITE_MAP_ATTRIBUTION as string | undefined) ?? '',
})

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 } } })
createApp(App).use(router).use(VueQueryPlugin, { queryClient }).mount('#app')
