<script setup lang="ts">
import { Bell, Building2, LayoutList, Radar, Shapes, TableProperties, Tags } from 'lucide-vue-next'
import { AppShell, ConfirmHost, Toaster, TooltipProvider, translate as t, usePreferences, type NavSection } from '@truth-platform/ui'
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { SUBSCRIPTIONS_ENABLED } from './features'

const route = useRoute()
const { language } = usePreferences()
const sections = computed<NavSection[]>(() => {
  void language.value
  return [
    { items: [{ to: '/events', label: t('nav.inventory'), icon: LayoutList }] },
    {
      label: t('nav.settings'),
      items: [
        { to: '/schema', label: t('nav.schema'), icon: TableProperties },
        { to: '/types', label: t('nav.types'), icon: Shapes },
        { to: '/platforms', label: t('nav.platforms'), icon: Tags },
        { to: '/industries', label: t('nav.industries'), icon: Building2 },
        ...(SUBSCRIPTIONS_ENABLED ? [{ to: '/subscriptions', label: t('nav.subscriptions'), icon: Bell }] : []),
      ],
    },
  ]
})
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <AppShell brand="Skyscanner" :tagline="t('app.tagline')" :logo="Radar" :sections="sections" :wide="route.meta.wide === true">
      <template #header><div id="header-slot" /></template>
      <RouterView />
    </AppShell>
    <ConfirmHost />
    <Toaster />
  </TooltipProvider>
</template>
