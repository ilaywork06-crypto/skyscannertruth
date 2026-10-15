<script setup lang="ts">
/** One industry's register. Visiting it is remembered, so `/` lands back here next time. */
import { ChevronLeft } from 'lucide-vue-next'
import { Badge, Button, PageHeader, hashedTone, translate as t } from '@truth-platform/ui'
import { computed, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AssumptionsRegister from '@/components/AssumptionsRegister.vue'
import { useRegister } from '@/composables/register'
import { writeLastIndustry } from '@/lib/misc'

const route = useRoute()
const register = useRegister()
const id = computed(() => String(route.params.id ?? ''))
watch(id, (v) => writeLastIndustry(v), { immediate: true })
const industry = computed(() => register.findIndustry(id.value))
</script>

<template>
  <PageHeader>
    <template #eyebrow>
      <Button as-child variant="link" size="sm" class="text-muted-foreground">
        <RouterLink to="/industries" :aria-label="t('industries.back')"><ChevronLeft class="rtl:rotate-180" />{{ t('industries.title') }}</RouterLink>
      </Button>
    </template>
    <template #title>
      <span class="inline-flex items-center gap-3">
        <span dir="auto">{{ industry?.name ?? t('industries.fallbackName') }}</span>
        <Badge v-if="industry" :tone="hashedTone(industry.name)" class="text-xs">{{ register.countsByIndustry.value.get(industry.name) ?? 0 }}</Badge>
      </span>
    </template>
  </PageHeader>
  <AssumptionsRegister :key="id" :industry="id" />
</template>
