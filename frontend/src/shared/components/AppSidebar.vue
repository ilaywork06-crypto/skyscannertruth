<template>
  <v-navigation-drawer
    :model-value="mobile ? mobileOpen : true"
    :rail="!mobile && preferences.rail"
    :permanent="!mobile"
    :temporary="mobile"
    :width="272"
    :rail-width="76"
    color="sidebar"
    class="sidebar"
    @update:model-value="emit('update:mobileOpen', $event)"
  >
    <div class="sidebar__inner">
      <div class="sidebar__brand">
        <BrandMark :compact="!mobile && preferences.rail" />
      </div>

      <nav class="sidebar__nav" :aria-label="t('nav.workspace')">
        <SidebarLink to="/industries" icon="mdi-domain" :label="t('nav.industries')" :rail="isRail" :active="isSection('/industries')" />
        <SidebarLink to="/schemas" icon="mdi-shape-outline" :label="t('nav.schemas')" :rail="isRail" :active="isSection('/schemas')" />
      </nav>

      <div v-if="!isRail" class="sidebar__section">
        <div class="sidebar__heading">{{ t('nav.yourIndustries') }}</div>
        <div v-if="!register.isReady && register.state === 'loading'" class="sidebar__skeletons">
          <v-skeleton-loader v-for="index in 4" :key="index" type="text" class="sidebar__skeleton" />
        </div>
        <p v-else-if="register.industries.length === 0" class="sidebar__empty">{{ t('nav.noIndustries') }}</p>
        <div v-else class="sidebar__industries">
          <RouterLink
            v-for="industry in sortedIndustries"
            :key="industry.id"
            :to="`/industries/${industry.id}`"
            class="industry-link"
            :class="{ 'industry-link--active': route.params.id === industry.id && route.name === 'industry' }"
          >
            <span class="industry-link__dot" :style="{ background: `rgb(var(--v-theme-${chipColor(industry.name)}))` }" />
            <span class="industry-link__name bidi">{{ industry.name }}</span>
            <span class="industry-link__count tabular">{{ register.countsByIndustry.get(industry.id) ?? 0 }}</span>
          </RouterLink>
        </div>
      </div>

      <v-spacer />

      <div class="sidebar__footer" :class="{ 'sidebar__footer--rail': isRail }">
        <v-tooltip :text="preferences.theme === 'dark' ? t('common.lightTheme') : t('common.darkTheme')">
          <template #activator="{ props: tip }">
            <v-btn
              v-bind="tip"
              variant="text"
              size="small"
              :icon="preferences.theme === 'dark' ? 'mdi-weather-sunny' : 'mdi-weather-night'"
              :aria-label="preferences.theme === 'dark' ? t('common.lightTheme') : t('common.darkTheme')"
              @click="preferences.toggleTheme()"
            />
          </template>
        </v-tooltip>
        <v-tooltip :text="t('common.languageLabel')">
          <template #activator="{ props: tip }">
            <v-btn
              v-bind="tip"
              variant="text"
              size="small"
              :icon="isRail ? 'mdi-translate' : undefined"
              :aria-label="t('common.languageLabel')"
              @click="setLanguage(language === 'he' ? 'en' : 'he')"
            >
              <template v-if="!isRail">
                <v-icon start icon="mdi-translate" />{{ t('common.language') }}
              </template>
            </v-btn>
          </template>
        </v-tooltip>
        <v-spacer v-if="!isRail" />
        <v-btn
          v-if="!mobile"
          variant="text"
          size="small"
          :icon="railIcon"
          :aria-label="preferences.rail ? t('nav.expand') : t('nav.collapse')"
          @click="preferences.rail = !preferences.rail"
        />
      </div>

      <div v-if="!isRail" class="sidebar__user">
        <v-avatar size="30" class="sidebar__avatar">{{ initials(creator) }}</v-avatar>
        <span class="sidebar__user-name">{{ creator }}</span>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'

import { useI18n } from '@/i18n'
import { chipColor, initials } from '@/shared/utils/colors'
import { currentCreator } from '@/shared/utils/identity'
import { usePreferences } from '@/stores/preferences'
import { useRegisterStore } from '@/stores/register'

import BrandMark from './BrandMark.vue'
import SidebarLink from './SidebarLink.vue'

defineProps<{ mobileOpen: boolean }>()
const emit = defineEmits<{ 'update:mobileOpen': [open: boolean] }>()

const route = useRoute()
const register = useRegisterStore()
const preferences = usePreferences()
const { mobile } = useDisplay()
const { t, language, isRtl, setLanguage } = useI18n()

const creator = currentCreator()
const isRail = computed(() => !mobile.value && preferences.rail)
const railIcon = computed(() => {
  const pointsBack = preferences.rail === isRtl.value

  return pointsBack ? 'mdi-chevron-double-left' : 'mdi-chevron-double-right'
})

const sortedIndustries = computed(() => [...register.industries].sort((a, b) => a.name.localeCompare(b.name)))

const isSection = (path: string): boolean =>
  route.path === path || route.path.startsWith(`${path}/`) || (path === '/industries' && route.name === 'assumption')
</script>

<style scoped>
.sidebar {
  border-inline-end: 1px solid rgb(var(--v-theme-border)) !important;
}

.sidebar__inner {
  display: flex;
  flex-direction: column;
  block-size: 100%;
  padding: 1.25rem 0.85rem 1rem;
  gap: 1.25rem;
}

.sidebar__brand {
  padding-inline: 0.5rem;
  min-block-size: 2.5rem;
  display: flex;
  align-items: center;
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar__section {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-block-size: 0;
  overflow: hidden;
}

.sidebar__heading {
  padding-inline: 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-muted));
}

.sidebar__empty {
  padding-inline: 0.75rem;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}

.sidebar__skeleton {
  background: transparent;
}

.sidebar__industries {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow-y: auto;
  max-block-size: calc(100vh - 22rem);
}

.industry-link {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.45rem 0.75rem;
  border-radius: 10px;
  color: rgb(var(--v-theme-on-surface));
  text-decoration: none;
  font-size: 0.875rem;
  opacity: 0.82;
  transition: background-color 0.15s, opacity 0.15s;
}

.industry-link:hover {
  background: rgb(var(--v-theme-row-hover));
  opacity: 1;
}

.industry-link--active {
  background: rgb(var(--v-theme-row-selected));
  opacity: 1;
  font-weight: 600;
}

.industry-link__dot {
  inline-size: 0.5rem;
  block-size: 0.5rem;
  border-radius: 50%;
  flex: none;
}

.industry-link__name {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.industry-link__count {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-muted));
}

.sidebar__footer {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgb(var(--v-theme-border));
}

.sidebar__footer--rail {
  flex-direction: column;
}

.sidebar__user {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-inline: 0.5rem;
  font-size: 0.8125rem;
}

.sidebar__avatar {
  background: var(--truth-gradient);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
}

.sidebar__user-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
