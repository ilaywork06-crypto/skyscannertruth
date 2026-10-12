<template>
  <header class="app-header">
    <!-- The two switches of the interface itself stand together at the left end of the band. -->
    <div class="app-header__switches">
      <LanguageSwitch />
      <ThemeToggle />
    </div>

    <nav
      class="app-header__nav"
      :aria-label="t('app.sections')"
    >
      <!--
        The industries are a menu rather than a row of links, because a register may carry more of them than
        a header has room for. Picking one leads to that industry's own page; the entry above them leads to
        the list of all of them.

        There is no way from here into the whole register at once, and that is deliberate. An assumption is
        always read under the industry it was filed under, so a table of every industry together was a page
        that answered a question nobody was asking and cost a reading of the whole register to draw.
      -->
      <v-menu location="bottom start">
        <template #activator="{ props: activator }">
          <button
            v-bind="activator"
            type="button"
            class="app-header__link app-header__link--menu"
            :class="{ 'app-header__link--active': isActive('/industries') }"
          >
            <v-icon
              size="x-small"
              icon="mdi-chevron-up"
            />
            {{ t('app.industries') }}
          </button>
        </template>
        <v-list
          class="app-header__menu"
          density="compact"
        >
          <v-list-item
            :title="t('app.allIndustries')"
            prepend-icon="mdi-view-grid-outline"
            to="/industries"
          />
          <v-divider v-if="industries.length > 0" />
          <v-list-item
            v-for="industry in industries"
            :key="industry.id"
            :title="localName(industry)"
            :to="`/industries/${industry.id}`"
          />
          <v-list-item
            v-if="industries.length === 0"
            :title="t('app.noIndustries')"
            disabled
          />
        </v-list>
      </v-menu>
    </nav>

    <RouterLink
      class="app-header__brand"
      to="/industries"
    >
      <svg
        class="app-header__mark"
        viewBox="0 0 32 32"
        aria-hidden="true"
      >
        <path
          d="M16 3 L29 10 L16 17 L3 10 Z"
          fill="currentColor"
          opacity="0.9"
        />
        <path
          d="M3 16 L16 23 L29 16"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linejoin="round"
          opacity="0.6"
        />
        <path
          d="M3 22 L16 29 L29 22"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linejoin="round"
          opacity="0.35"
        />
      </svg>
      <span class="app-header__wordmark">{{ t('app.name') }}</span>
    </RouterLink>

    <!--
      The pages that shape the register - its schemas and industries - are reached from the dots beside the
      wordmark. They are the register's vocabulary rather than its settings, so they are not filed under a cog.
    -->
    <v-menu location="bottom end">
      <template #activator="{ props: activator }">
        <v-btn
          v-bind="activator"
          icon="mdi-dots-vertical"
          variant="text"
          size="small"
          :aria-label="t('app.more')"
          :title="t('app.more')"
        />
      </template>
      <v-list density="compact">
        <v-list-item
          :title="t('app.schemas')"
          prepend-icon="mdi-table-cog"
          to="/schemas"
        />
        <v-list-item
          :title="t('industries.title')"
          prepend-icon="mdi-domain"
          to="/industries"
        />
      </v-list>
    </v-menu>

    <slot name="tabs" />
  </header>
</template>

<script lang="ts">
import type { Industry } from '@/models/industry'

interface Props {
  industries?: Industry[]
}
</script>

<script setup lang="ts">
import { LanguageSwitch, ThemeToggle, localName, useLanguage } from '@truth-platform/core-ui'
import { RouterLink, useRoute } from 'vue-router'

withDefaults(defineProps<Props>(), { industries: () => [] })

const route = useRoute()
const { t } = useLanguage()

/** A section is lit while the reader is anywhere underneath it, not only on its own address. */
const isActive = (path: string): boolean => route.path === path || route.path.startsWith(`${path}/`)
</script>

<style scoped>
/*
 * The header is a single dark band across the top of every page: the sections at one end, the wordmark at the
 * other, and the controls between them. It lays itself out in a row that wraps rather than in fixed columns,
 * so a narrow window stacks it instead of pushing the wordmark off the screen.
 */
.app-header {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding-inline: 2rem;
  padding-block: 0.75rem;
  background-image: linear-gradient(
    100deg,
    rgb(var(--v-theme-app-header-start)) 0%,
    rgb(var(--v-theme-app-header-end)) 100%
  );
  color: rgb(var(--v-theme-on-surface));
}

.app-header__nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex: 1 1 auto;
  min-inline-size: 0;
}

.app-header__link {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-block: 0.25rem;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-decoration: none;
  cursor: pointer;
  opacity: 0.75;
  transition: opacity 0.15s ease-in-out;
}

.app-header__link:hover,
.app-header__link--active {
  opacity: 1;
}

.app-header__link--active {
  box-shadow: inset 0 -0.125rem 0 0 currentColor;
}

.app-header__menu {
  min-inline-size: 12rem;
}

.app-header__switches {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: inherit;
  text-decoration: none;
}

.app-header__mark {
  inline-size: clamp(1.75rem, 2.2vw, 2.25rem);
  block-size: clamp(1.75rem, 2.2vw, 2.25rem);
  color: rgb(var(--v-theme-primary));
  flex: 0 0 auto;
}

/* The wordmark is the one piece of the design drawn in the display family rather than in the interface one. */
.app-header__wordmark {
  font-family: var(--truth-font-display);
  font-size: clamp(1.25rem, 1.8vw, 1.75rem);
  font-weight: 500;
  letter-spacing: 0.3em;
}

@media (max-width: 48rem) {
  .app-header {
    padding-inline: 1rem;
  }

  .app-header__nav {
    gap: 1rem;
  }
}
</style>
