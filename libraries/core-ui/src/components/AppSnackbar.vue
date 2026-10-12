<template>
  <v-snackbar
    v-model="visible"
    :color="tone"
    location="bottom right"
    :timeout="TIMEOUT_MS"
  >
    <span class="app-snackbar__text">{{ message }}</span>
  </v-snackbar>
</template>

<script lang="ts">
const TIMEOUT_MS = 5000
</script>

<script setup lang="ts">
import { useSnackbar } from '../composables/useSnackbar'

const { visible, message, tone } = useSnackbar()
</script>

<style scoped>
/* A message starts from the side of its own language, whichever language the page is in. */
.app-snackbar__text {
  display: block;
  unicode-bidi: plaintext;
  text-align: start;
}
</style>
