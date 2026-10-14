<script setup lang="ts">
/**
 * The frame every page sits in: a collapsible sidebar of sections, a header with the search and the
 * reader's preferences, and the page itself - which may ask for the full width (`wide`).
 */
import { ChevronsLeft, Menu as MenuIcon, Settings2 } from 'lucide-vue-next'
import { computed, ref, watch, type Component } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { cn } from '../../lib/cn'
import { translate as t } from '../../i18n'
import { usePreferences } from '../../theme/preferences'
import Button from '../ui/Button.vue'
import Tooltip from '../ui/Tooltip.vue'
import PrefsMenu from './PrefsMenu.vue'
import type { NavItem, NavSection } from './types'

const props = defineProps<{
  brand: string
  tagline?: string
  logo?: Component
  sections: NavSection[]
  wide?: boolean
}>()

const prefs = usePreferences()
const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
watch(() => route.fullPath, () => (mobileOpen.value = false))

function isActive(item: NavItem): boolean {
  const path = item.match ?? router.resolve(item.to).path
  return item.exact ? route.path === path : route.path === path || route.path.startsWith(path.endsWith('/') ? path : `${path}/`)
}

const collapsed = computed(() => prefs.sidebarCollapsed.value)
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <!-- Desktop sidebar -->
    <aside
      :class="cn(
        'hidden shrink-0 flex-col border-e border-border bg-sidebar transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[68px]' : 'w-64',
      )"
    >
      <div :class="cn('flex h-14 shrink-0 items-center gap-2.5 px-4', collapsed && 'justify-center px-0')">
        <div class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-soft [&_svg]:size-[18px]">
          <component :is="logo" v-if="logo" />
        </div>
        <div v-if="!collapsed" class="min-w-0 leading-tight">
          <div class="truncate text-[15px] font-semibold tracking-tight">{{ brand }}</div>
          <div v-if="tagline" class="truncate text-[11px] text-muted-foreground">{{ tagline }}</div>
        </div>
      </div>
      <nav class="flex-1 overflow-y-auto px-3 pb-4 pt-2">
        <div v-for="(section, si) in sections" :key="si" class="mb-4">
          <div v-if="section.label && !collapsed" class="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
            {{ section.label }}
          </div>
          <div v-else-if="section.label" class="mx-auto mb-2 h-px w-6 bg-border" />
          <Tooltip v-for="item in section.items" :key="item.label" :content="collapsed ? item.label : null" side="right">
            <RouterLink
              :to="item.to"
              :class="cn(
                'group relative mb-0.5 flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
                isActive(item) ? 'bg-card text-foreground shadow-soft ring-1 ring-border' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-0',
              )"
            >
              <component :is="item.icon" :class="cn('size-[18px] shrink-0', isActive(item) && 'text-primary')" />
              <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
              <span
                v-if="item.badge"
                :class="cn(
                  'grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground',
                  collapsed ? 'absolute -end-1 -top-1 scale-90' : 'ms-auto',
                )"
              >{{ item.badge }}</span>
            </RouterLink>
          </Tooltip>
        </div>
      </nav>
      <div class="border-t border-border p-3">
        <button
          type="button"
          :class="cn('flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground', collapsed && 'justify-center px-0')"
          @click="prefs.setSidebarCollapsed(!collapsed)"
        >
          <ChevronsLeft :class="cn('size-4 transition-transform rtl:rotate-180', collapsed && 'rotate-180 rtl:rotate-0')" />
          <span v-if="!collapsed">{{ t('nav.collapse') }}</span>
        </button>
      </div>
    </aside>

    <!-- Mobile drawer -->
    <div v-if="mobileOpen" class="fixed inset-0 z-40 lg:hidden">
      <div class="absolute inset-0 animate-fade bg-black/40" @click="mobileOpen = false" />
      <aside class="absolute inset-y-0 start-0 flex w-72 animate-in flex-col border-e border-border bg-sidebar shadow-pop">
        <div class="flex h-14 items-center gap-2.5 px-4">
          <div class="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground [&_svg]:size-[18px]"><component :is="logo" v-if="logo" /></div>
          <div class="text-[15px] font-semibold">{{ brand }}</div>
        </div>
        <nav class="flex-1 overflow-y-auto px-3 pb-4">
          <div v-for="(section, si) in sections" :key="si" class="mb-4">
            <div v-if="section.label" class="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">{{ section.label }}</div>
            <RouterLink
              v-for="item in section.items"
              :key="item.label"
              :to="item.to"
              :class="cn('mb-0.5 flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] font-medium', isActive(item) ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:bg-muted')"
            >
              <component :is="item.icon" class="size-[18px]" /> {{ item.label }}
              <span v-if="item.badge" class="ms-auto grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{{ item.badge }}</span>
            </RouterLink>
          </div>
        </nav>
      </aside>
    </div>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
        <Button variant="ghost" size="icon-sm" class="lg:hidden" :aria-label="t('nav.menu')" @click="mobileOpen = true"><MenuIcon /></Button>
        <div class="min-w-0 flex-1"><slot name="header" /></div>
        <div class="ms-auto flex items-center gap-1.5">
          <slot name="header-actions" />
          <PrefsMenu>
            <Button variant="ghost" size="icon-sm" :aria-label="t('prefs.account')"><Settings2 /></Button>
          </PrefsMenu>
        </div>
      </header>
      <main id="main" class="flex-1 overflow-y-auto">
        <div :class="cn('mx-auto w-full px-4 py-6 lg:px-8 lg:py-8', !props.wide && 'max-w-[1400px]')">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
