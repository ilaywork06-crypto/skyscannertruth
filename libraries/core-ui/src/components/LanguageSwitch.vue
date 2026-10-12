<template>
  <!--
    One round button, the height and outline of the theme switch beside it, that names the language the page is
    in and moves to the other one when pressed. Its label names the language it leads to, in that language, so
    the way back is readable from either side.
  -->
  <button
    type="button"
    class="language-switch"
    dir="ltr"
    :lang="language"
    :title="LANGUAGE_NAMES[other]"
    :aria-label="LANGUAGE_NAMES[other]"
    @click="toggle"
  >
    {{ SHORT_NAMES[language] }}
  </button>
</template>

<script lang="ts">
import type { Language } from '../composables/useLanguage'

/** What each language is called on the switch itself. */
const SHORT_NAMES: Record<Language, string> = { en: 'EN', he: 'עב' }
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { LANGUAGE_NAMES, useLanguage } from '../composables/useLanguage'

const { language, toggle } = useLanguage()

/* The language a press leads to, which is what the button names itself after. */
const other = computed<Language>(() => (language.value === 'en' ? 'he' : 'en'))
</script>

<style scoped>
.language-switch {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  inline-size: 2rem;
  block-size: 2rem;
  padding: 0;
  border: 0.0625rem solid rgba(var(--v-theme-on-surface), 0.55);
  border-radius: 50%;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s ease-in-out;
}

.language-switch:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.14);
}

.language-switch:focus-visible {
  outline: 0.125rem solid rgb(var(--v-theme-primary));
  outline-offset: 0.0625rem;
}
</style>
