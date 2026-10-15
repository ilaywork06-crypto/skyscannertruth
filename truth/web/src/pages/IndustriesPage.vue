<script setup lang="ts">
/** Every industry as a card, with how many assumptions are filed under it (counted as readings land). */
import { Building2, ChevronRight, Plus } from 'lucide-vue-next'
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton, hashedTone, reportError, translate as t } from '@truth-platform/ui'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import CreateIndustryDialog from '@/components/CreateIndustryDialog.vue'
import { useRegister } from '@/composables/register'

const register = useRegister()
const createOpen = ref(false)
const count = (name: string) => register.countsByIndustry.value.get(name) ?? 0

async function onCreated() {
  try {
    await register.load(true)
  } catch (e) {
    reportError(e)
  }
}
</script>

<template>
  <PageHeader :title="t('industries.title')" :description="t('industries.note')">
    <template #actions>
      <Button variant="primary" @click="createOpen = true"><Plus /> {{ t('industries.new') }}</Button>
    </template>
  </PageHeader>
  <div v-if="register.loading.value && !register.industries.value.length" class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
    <Skeleton v-for="n in 6" :key="n" class="h-28" />
  </div>
  <Card v-else-if="!register.industries.value.length">
    <EmptyState :title="t('industries.empty')">
      <template #icon><Building2 /></template>
      <template #action><Button variant="primary" @click="createOpen = true"><Plus /> {{ t('industries.new') }}</Button></template>
    </EmptyState>
  </Card>
  <div v-else class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
    <RouterLink
      v-for="i in register.industries.value"
      :key="i.id"
      :to="`/industries/${i.id}`"
      class="card-surface group flex flex-col gap-4 p-5 transition-all hover:-translate-y-px hover:shadow-pop"
    >
      <div class="flex items-center justify-between gap-2">
        <Badge :tone="hashedTone(i.name)" class="max-w-full text-[13px]"><span class="truncate" dir="auto">{{ i.name }}</span></Badge>
        <ChevronRight class="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
      </div>
      <div class="flex items-baseline gap-1.5">
        <span class="text-[28px] font-semibold leading-none tabular-nums tracking-tight">{{ count(i.name) }}</span>
        <span class="text-sm text-muted-foreground">{{ count(i.name) === 1 ? t('industries.one') : t('industries.many') }}</span>
        <span v-if="register.completing.value" class="ms-auto animate-pulse text-xs text-muted-foreground">{{ t('industries.counting') }}</span>
      </div>
    </RouterLink>
  </div>
  <CreateIndustryDialog v-model:open="createOpen" @created="onCreated" />
</template>
