<script setup lang="ts">
/** One schema at its latest revision: what it declares, for which industries, and the way to revise it. */
import { useQuery } from '@tanstack/vue-query'
import { AlertCircle, Check, ChevronLeft, ListTree, PencilLine, TableProperties } from 'lucide-vue-next'
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, LinkedText, PageHeader, Skeleton, TD, TH, TR, Table,
  formatDateTime, hashedTone, nameColumnOrder, reportError, translate as t, usePreferences,
} from '@truth-platform/ui'
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { readLatestSchema } from '@/api/endpoints'
import CreateSchemaDialog from '@/components/CreateSchemaDialog.vue'
import { useRegister } from '@/composables/register'
import { appliesEverywhere } from '@/models'
import { fieldNames, hasOptions, isNumeric, readScheme, typeLabel, type SchemeField } from '@/lib/scheme'

const route = useRoute()
const register = useRegister()
const { direction, language } = usePreferences()
const id = computed(() => String(route.params.id ?? ''))
const query = useQuery({ queryKey: ['schema', id], queryFn: () => readLatestSchema(id.value), retry: false })
const s = computed(() => query.data.value ?? null)
const fields = computed(() => readScheme(s.value?.scheme).fields)
const reviseOpen = ref(false)
const nameSides = computed(() => {
  void language.value
  return nameColumnOrder()
})
const state = computed(() => (s.value?.deleted ? t('detail.removed') : s.value?.archived ? t('detail.archived') : ''))

function allowed(f: SchemeField): string {
  if (!isNumeric(f.type)) return '—'
  const parts = [f.min !== null ? `≥ ${f.min}` : '', f.max !== null ? `≤ ${f.max}` : '', f.step !== null ? `± ${f.step}` : ''].filter(Boolean)
  return parts.length ? parts.join('  ') : '—'
}

async function onRevised() {
  await query.refetch()
  try {
    await register.load(true)
  } catch (e) {
    reportError(e)
  }
}
</script>

<template>
  <PageHeader>
    <template #eyebrow>
      <div class="flex items-center gap-2">
        <Button as-child variant="link" size="sm" class="text-muted-foreground">
          <RouterLink to="/schemas" :aria-label="t('schemas.back')"><ChevronLeft class="rtl:rotate-180" />{{ t('schemas.title') }}</RouterLink>
        </Button>
        <Badge tone="primary">{{ t('schemas.badge') }}</Badge>
      </div>
    </template>
    <template #title><span dir="auto">{{ s?.name ?? t('schemas.badge') }}</span></template>
    <template v-if="s?.description" #description><span dir="auto"><LinkedText :text="s.description" /></span></template>
    <template v-if="s" #actions>
      <Button variant="primary" @click="reviseOpen = true"><PencilLine /> {{ t('schemas.revise') }}</Button>
    </template>
  </PageHeader>

  <div v-if="query.isPending.value" class="space-y-4"><Skeleton class="h-28" /><Skeleton class="h-64" /></div>
  <Card v-else-if="query.isError.value">
    <EmptyState :title="t('schemas.unreadable')" :description="query.error.value?.message"><template #icon><AlertCircle /></template></EmptyState>
  </Card>
  <div v-else-if="s" class="flex flex-col gap-4">
    <Card>
      <CardHeader :title="t('assumption.facts')"><template #icon><ListTree /></template></CardHeader>
      <CardBody>
        <dl class="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt class="mb-1 text-muted-foreground">{{ t('column.industry') }}</dt>
            <dd class="flex flex-wrap gap-1">
              <template v-if="!appliesEverywhere(s)">
                <Badge v-for="i in s.industries" :key="i.id" :tone="hashedTone(i.name)"><span dir="auto">{{ i.name }}</span></Badge>
              </template>
              <Badge v-else tone="primary">{{ s.global === true ? t('schemas.globalShort') : t('schemas.allIndustries') }}</Badge>
            </dd>
          </div>
          <div>
            <dt class="mb-1 text-muted-foreground">{{ t('column.revision') }}</dt>
            <dd dir="auto">{{ s.revision }}<template v-if="s.revision_reason"> · {{ s.revision_reason }}</template></dd>
          </div>
          <div v-if="state">
            <dt class="mb-1 text-muted-foreground">{{ t('detail.state') }}</dt>
            <dd><Badge tone="danger">{{ state }}</Badge></dd>
          </div>
          <div>
            <dt class="mb-1 text-muted-foreground">{{ t('column.createdAt') }}</dt>
            <dd><span dir="ltr" class="tabular-nums">{{ formatDateTime(s.created_at) }}</span> · <span dir="auto">{{ s.creator }}</span></dd>
          </div>
        </dl>
      </CardBody>
    </Card>
    <Card>
      <CardHeader :title="t('schemas.attributes')">
        <template #icon><TableProperties /></template>
        <template #description><Badge>{{ fields.length }}</Badge></template>
      </CardHeader>
      <EmptyState v-if="!fields.length" compact :title="t('schemas.noAttributes')" />
      <Table v-else :dir="direction">
        <thead>
          <tr>
            <TH>{{ t('schemas.key') }}</TH>
            <TH v-for="side in nameSides" :key="side">{{ t(`names.${side}`) }}</TH>
            <TH>{{ t('schemas.type') }}</TH>
            <TH>{{ t('schemas.required') }}</TH>
            <TH>{{ t('schemas.many') }}</TH>
            <TH>{{ t('schemas.allowed') }}</TH>
          </tr>
        </thead>
        <tbody>
          <TR v-for="f in fields" :key="f.key">
            <TD><code class="mono text-xs" dir="ltr">{{ f.key }}</code></TD>
            <TD v-for="side in nameSides" :key="side" :dir="side === 'english' ? 'ltr' : 'rtl'">{{ fieldNames(f)[side] || '—' }}</TD>
            <TD><Badge tone="indigo">{{ typeLabel(f.type) }}</Badge></TD>
            <TD><Check v-if="f.required" class="size-4 text-success" /><span v-else class="text-muted-foreground">—</span></TD>
            <TD><Check v-if="f.array" class="size-4 text-success" /><span v-else class="text-muted-foreground">—</span></TD>
            <TD>
              <span v-if="hasOptions(f.type)" class="flex flex-wrap gap-1">
                <Badge v-for="o in f.options" :key="o"><span dir="auto">{{ o }}</span></Badge>
              </span>
              <span v-else dir="ltr" class="whitespace-pre tabular-nums text-muted-foreground">{{ allowed(f) }}</span>
            </TD>
          </TR>
        </tbody>
      </Table>
    </Card>
  </div>
  <CreateSchemaDialog v-model:open="reviseOpen" :revised="s" @saved="onRevised" />
</template>
