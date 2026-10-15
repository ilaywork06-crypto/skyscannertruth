<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import { usePreferences } from '../../theme/preferences'
const { isDark, direction } = usePreferences()
</script>

<template>
  <Toaster
    :theme="isDark ? 'dark' : 'light'"
    :dir="direction"
    position="bottom-right"
    rich-colors
    close-button
    :duration="5000"
    :toast-options="{ class: 'font-sans [unicode-bidi:plaintext]' }"
  />
</template>
