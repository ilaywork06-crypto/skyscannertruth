<template>
  <header class="app-header">
    <svg
      class="app-header__trail"
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 84 C 90 16, 190 8, 268 44 C 340 78, 402 82, 470 44 C 540 6, 606 12, 660 44"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-dasharray="14 12"
        stroke-linecap="round"
      />
      <path
        d="M760 30 L 700 52 L 726 58 L 736 82 Z M726 58 L 760 30 L 742 66 Z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path
        d="M790 40 C 860 74, 960 76, 1050 44 C 1110 22, 1160 20, 1200 30"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-dasharray="14 12"
        stroke-linecap="round"
      />
    </svg>

    <div class="app-header__content">
      <!-- The two switches of the interface itself stand together at the left end of the band. -->
      <div class="app-header__switches">
        <LanguageSwitch />
        <ThemeToggle />
      </div>

      <!--
        The mark and the wordmark are one lockup: the mark is drawn in the colour of the letters, at their
        height, rather than as an app icon set down beside them.
      -->
      <RouterLink
        to="/events"
        class="app-header__brand"
        :aria-label="t('app.home')"
      >
        <svg
          class="app-header__mark"
          viewBox="0 0 40 40"
          aria-hidden="true"
        >
          <circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            opacity="0.45"
          />
          <path
            d="M20 20 L20 3 A17 17 0 0 1 33.9 10.2 Z"
            fill="currentColor"
            opacity="0.35"
          />
          <path
            d="M29.5 12.5 L8.5 20.6 L16.2 22.4 L19.1 30.5 Z M16.2 22.4 L29.5 12.5 L20.6 25.4 Z"
            fill="currentColor"
          />
        </svg>
        <span class="app-header__wordmark">Skyscanner</span>
      </RouterLink>

      <!--
        The pages that shape the system - its industries, platforms, types and fields - are reached from the
        dots beside the wordmark. They are the system's vocabulary rather than its settings, so they are not
        filed under a cog.
      -->
      <v-menu location="bottom end">
        <template #activator="{ props: activator }">
          <v-btn
            v-bind="activator"
            class="app-header__icon"
            icon="mdi-dots-vertical"
            variant="text"
            size="small"
            :aria-label="t('app.more')"
            :title="t('app.more')"
          />
        </template>
        <v-list density="compact">
          <v-list-item
            v-if="SUBSCRIPTIONS_ENABLED"
            :title="t('app.subscriptions')"
            prepend-icon="mdi-bell-outline"
            to="/subscriptions"
          />
          <v-list-item
            :title="t('app.industries')"
            prepend-icon="mdi-domain"
            to="/industries"
          />
          <v-list-item
            :title="t('app.platforms')"
            prepend-icon="mdi-epsilon"
            to="/platforms"
          />
          <v-list-item
            :title="t('app.types')"
            prepend-icon="mdi-shape-outline"
            to="/types"
          />
          <v-list-item
            :title="t('app.schema')"
            prepend-icon="mdi-table-cog"
            to="/schema"
          />
        </v-list>
      </v-menu>
    </div>

    <slot name="tabs" />
  </header>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { LanguageSwitch, ThemeToggle, useLanguage } from '@truth-platform/core-ui'
import { SUBSCRIPTIONS_ENABLED } from '@/features'

const { t } = useLanguage()
</script>

<style scoped>
.app-header {
  position: relative;
  display: flex;
  flex-direction: column;
  background-image: linear-gradient(
    100deg,
    rgb(var(--v-theme-app-header-start)) 0%,
    rgb(var(--v-theme-app-header-end)) 100%
  );
  color: rgb(var(--v-theme-on-surface));
  overflow: hidden;
}

.app-header__trail {
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  block-size: 5rem;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.35;
  pointer-events: none;
}

.app-header__content {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding-inline: 2rem;
  padding-block: 1.25rem 0.75rem;
}

.app-header__switches {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-inline-end: auto;
}

.app-header__icon.v-btn {
  color: rgb(var(--v-theme-on-surface));
}

/*
 * The lockup: the mark sits on the same line as the letters and is as tall as their capitals, in their
 * colour, so the two read as one name.
 */
.app-header__brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: inherit;
  text-decoration: none;
  line-height: 1;
}

.app-header__mark {
  flex: 0 0 auto;
  inline-size: clamp(1.75rem, 2.3vw, 2.25rem);
  block-size: clamp(1.75rem, 2.3vw, 2.25rem);
}

/* The wordmark is the one piece of the design drawn in the display family rather than in the interface one. */
.app-header__wordmark {
  font-family: var(--sky-font-display);
  font-size: clamp(1.75rem, 2.4vw, 2.5rem);
  font-weight: 400;
  letter-spacing: 0.01em;
  /* Kufam sits high in its line box, so the letters are lowered onto the centre line the mark is drawn on. */
  padding-block-start: 0.12em;
}

@media (max-width: 48rem) {
  .app-header__content {
    padding-inline: 1rem;
    gap: 0.75rem;
  }
}
</style>
