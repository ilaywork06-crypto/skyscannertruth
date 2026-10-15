/**
 * Entry point: plugins, then mount.
 */

import '@fontsource-variable/inter'
import '@/app/styles.scss'

import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from '@/app/App.vue'
import router from '@/app/router'
import vuetify from '@/app/vuetify'

createApp(App).use(createPinia()).use(router).use(vuetify).mount('#app')
