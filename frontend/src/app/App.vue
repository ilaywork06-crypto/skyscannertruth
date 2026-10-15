<template>
  <v-app>
    <AppSidebar v-model:mobile-open="mobileNavOpen" />

    <v-app-bar v-if="mobile" flat density="compact" class="app-topbar" border="b">
      <v-app-bar-nav-icon :aria-label="t('nav.menu')" @click="mobileNavOpen = !mobileNavOpen" />
      <BrandMark class="ms-1" />
    </v-app-bar>

    <v-main class="app-main">
      <v-alert
        v-if="register.state === 'error'"
        type="error"
        variant="tonal"
        class="ma-6 mb-0"
        rounded="lg"
        :title="t('errors.loadRegister')"
        :text="errorMessage(register.error)"
      >
        <template #append>
          <v-btn variant="tonal" color="error" @click="reload">{{ t('common.retry') }}</v-btn>
        </template>
      </v-alert>

      <RouterView v-slot="{ Component, route }">
        <transition name="page" mode="out-in">
          <component :is="Component" :key="route.path" />
        </transition>
      </RouterView>
    </v-main>

    <AppToasts />
  </v-app>
</template>

<script setup lang="ts">
import { onMounted, ref, watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import { useDisplay, useLocale, useTheme } from 'vuetify'

import { useI18n } from '@/i18n'
import AppSidebar from '@/shared/components/AppSidebar.vue'
import AppToasts from '@/shared/components/AppToasts.vue'
import BrandMark from '@/shared/components/BrandMark.vue'
import { errorMessage } from '@/shared/utils/errors'
import { useNotifications } from '@/stores/notifications'
import { usePreferences } from '@/stores/preferences'
import { useRegisterStore } from '@/stores/register'

import { DARK, LIGHT } from './vuetify'

const register = useRegisterStore()
const preferences = usePreferences()
const { reportError } = useNotifications()
const { t, language } = useI18n()
const { mobile } = useDisplay()
const theme = useTheme()
const locale = useLocale()

const mobileNavOpen = ref(false)

/* Keep Vuetify and the document in step with the reader's choices. */
watchEffect(() => {
  theme.change(preferences.theme === 'dark' ? DARK : LIGHT)
  locale.current.value = language.value
  document.documentElement.lang = language.value
  document.documentElement.dir = language.value === 'he' ? 'rtl' : 'ltr'
})

const reload = async () => {
  try {
    await register.load(true)
  } catch (error) {
    reportError(error)
  }
}

/* The whole register is read once, here: the API cannot answer narrower questions. */
onMounted(() => {
  register.load().catch(() => {
    /* Shown by the alert above. */
  })
})
</script>
