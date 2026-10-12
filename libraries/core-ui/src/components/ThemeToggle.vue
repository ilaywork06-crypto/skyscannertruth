<template>
  <!--
    A switch rather than a button: a pill with a knob that travels to the side of the theme it stands for. It
    is a plain button so that no library radius or ripple is laid over the pill, and it is always laid out left
    to right - which side stands for which theme does not change with the language of the page.
  -->
  <button
    type="button"
    role="switch"
    class="theme-toggle"
    :class="{ 'theme-toggle--dark': isDark }"
    dir="ltr"
    :aria-checked="isDark"
    :aria-label="isDark ? t('theme.toLight') : t('theme.toDark')"
    :title="isDark ? t('theme.toLight') : t('theme.toDark')"
    @click="toggle"
  >
    <span class="theme-toggle__knob">
      <v-icon
        :icon="isDark ? 'mdi-weather-night' : 'mdi-white-balance-sunny'"
        size="18"
      />
    </span>
  </button>
</template>

<script setup lang="ts">
import { useAppTheme } from '../composables/useAppTheme'
import { useLanguage } from '../composables/useLanguage'

const { isDark, toggle } = useAppTheme()
const { t } = useLanguage()
</script>

<style scoped>
.theme-toggle {
  --theme-toggle-height: 2rem;
  --theme-toggle-width: 3.75rem;
  --theme-toggle-inset: 0.1875rem;
  --theme-toggle-knob: calc(var(--theme-toggle-height) - 2 * var(--theme-toggle-inset) - 0.125rem);

  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  inline-size: var(--theme-toggle-width);
  block-size: var(--theme-toggle-height);
  padding: 0 var(--theme-toggle-inset);
  border: 0.0625rem solid rgba(var(--v-theme-on-surface), 0.55);
  border-radius: 999px;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
  transition: border-color 0.15s ease-in-out;
}

.theme-toggle:hover {
  border-color: rgb(var(--v-theme-on-surface));
}

.theme-toggle:focus-visible {
  outline: 0.125rem solid rgb(var(--v-theme-primary));
  outline-offset: 0.125rem;
}

.theme-toggle__knob {
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: var(--theme-toggle-knob);
  block-size: var(--theme-toggle-knob);
  border-radius: 50%;
  background-color: rgba(var(--v-theme-on-surface), 0.12);
  transition: transform 0.2s ease-in-out;
}

.theme-toggle--dark .theme-toggle__knob {
  transform: translateX(
    calc(var(--theme-toggle-width) - var(--theme-toggle-knob) - 2 * var(--theme-toggle-inset) - 0.125rem)
  );
}
</style>
