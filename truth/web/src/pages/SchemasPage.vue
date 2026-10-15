<script setup lang="ts">
/** Every schema as a card: its industries (or Global / Every industry), its attribute count and its revision. */
import { Plus, Search, SearchX, TableProperties, X } from 'lucide-vue-next'
import { Badge, Button, Card, EmptyState, Input, PageHeader, Skeleton, formatDateTime, hashedTone, reportError, translate as t } from '@truth-platform/ui'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import CreateSchemaDialog from '@/components/CreateSchemaDialog.vue'
import { useRegister } from '@/composables/register'
import type { SchemaSummary } from '@/models'
import { readScheme } from '@/lib/scheme'

const register = useRegister()
const createOpen = ref(false)
const search = ref('')
const shown = computed(() => {
  const needle = search.value.trim().toLowerCase()
  return register.schemas.value.filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.creator.toLowerCase().includes(needle))
})
const detail = (s: SchemaSummary) => register.schemaDetails.value.get(s.id)
const count = (s: SchemaSummary) => readScheme(detail(s)?.scheme).fields.length
const countText = (s: SchemaSummary) => (count(s) === 1 ? t('schemas.attributeCountOne') : t('schemas.attributeCount', { count: count(s) }))
const industriesOf = (s: SchemaSummary) => (detail(s)?.global === true ? [] : (detail(s)?.industries ?? []))

async function onSaved() {
  try {
    await register.load(true)
  } catch (e) {
    reportError(e)
  }
}
</script>

<template>
  <PageHeader :title="t('schemas.title')" :description="t('schemas.note')">
    <template #actions>
      <Button variant="primary" @click="createOpen = true"><Plus /> {{ t('schemas.new') }}</Button>
    </template>
  </PageHeader>
  <Input v-model="search" class="mb-5 max-w-sm" :placeholder="t('schemas.search')" :aria-label="t('schemas.search')">
    <template #start><Search /></template>
    <template v-if="search" #end><Button size="icon-xs" variant="ghost" :aria-label="t('common.clear')" @click="search = ''"><X /></Button></template>
  </Input>
  <div v-if="register.loading.value && !register.schemas.value.length" class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
    <Skeleton v-for="n in 3" :key="n" class="h-36" />
  </div>
  <Card v-else-if="!register.schemas.value.length">
    <EmptyState :title="t('schemas.empty')"><template #icon><TableProperties /></template></EmptyState>
  </Card>
  <Card v-else-if="!shown.length">
    <EmptyState :title="t('schemas.noMatch')"><template #icon><SearchX /></template></EmptyState>
  </Card>
  <div v-else class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(17rem,1fr))]">
    <RouterLink v-for="s in shown" :key="s.id" :to="`/schemas/${s.id}`" class="card-surface flex flex-col gap-3 p-5 transition-all hover:-translate-y-px hover:shadow-pop">
      <div class="flex items-start gap-3">
        <span class="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground"><TableProperties class="size-4" /></span>
        <h2 class="min-w-0 flex-1 truncate text-[15px] font-semibold" dir="auto">{{ s.name }}</h2>
        <Badge tone="outline">{{ t('schemas.revision', { number: s.revision }) }}</Badge>
      </div>
      <div class="flex min-h-6 flex-wrap gap-1">
        <Badge v-for="i in industriesOf(s)" :key="i.id" :tone="hashedTone(i.name)"><span dir="auto">{{ i.name }}</span></Badge>
        <Badge v-if="!industriesOf(s).length" tone="primary">{{ detail(s)?.global === true ? t('schemas.globalShort') : t('schemas.allIndustries') }}</Badge>
      </div>
      <p class="text-xs text-muted-foreground">
        {{ countText(s) }} · <span dir="ltr" class="tabular-nums">{{ formatDateTime(s.created_at) }}</span> · <span dir="auto">{{ s.creator }}</span>
      </p>
    </RouterLink>
  </div>
  <CreateSchemaDialog v-model:open="createOpen" @saved="onSaved" />
</template>
