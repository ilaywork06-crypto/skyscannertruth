<script setup lang="ts">
import { Building2, Layers, LayoutGrid, TableProperties } from 'lucide-vue-next'
import { AppShell, ConfirmHost, Toaster, TooltipProvider, reportError, translate as t, usePreferences, type NavSection } from '@truth-platform/ui'
import { computed, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useRegister } from './composables/register'

const route = useRoute()
const { language } = usePreferences()
const register = useRegister()

const sections = computed<NavSection[]>(() => {
  void language.value
  return [
    {
      label: t('nav.register'),
      items: [
        { to: '/industries', label: t('app.allIndustries'), icon: LayoutGrid, exact: true },
        ...register.industries.value.map((i) => ({
          to: `/industries/${i.id}`,
          label: i.name,
          icon: Building2,
          badge: register.countsByIndustry.value.get(i.name) || null,
        })),
      ],
    },
    { label: t('nav.declarations'), items: [{ to: '/schemas', label: t('app.schemas'), icon: TableProperties }] },
  ]
})

// The whole register is read once, here; pages re-read it after they write.
onMounted(() => register.load().catch(reportError))
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <AppShell brand="TRUTH" :tagline="t('app.tagline')" :logo="Layers" :sections="sections" :wide="route.meta.wide === true">
      <RouterView />
    </AppShell>
    <ConfirmHost />
    <Toaster />
  </TooltipProvider>
</template>
