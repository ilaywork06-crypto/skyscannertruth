<script setup lang="ts">
/** One assumption, read whole (`/latest`): its facts and the attributes its schemas declare. */
import { useQuery } from '@tanstack/vue-query'
import { AlertCircle, ChevronLeft, Copy, ListTree, TableProperties } from 'lucide-vue-next'
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, LinkedText, PageHeader, Skeleton, TD, TH, TR, Table,
  formatDateTime, hashedTone, reportError, translate as t, usePreferences,
} from '@truth-platform/ui'
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { readLatestAssumption } from '@/api/endpoints'
import CreateAssumptionDialog from '@/components/CreateAssumptionDialog.vue'
import ValueCell from '@/components/ValueCell.vue'
import { useRegister } from '@/composables/register'
import { readLastIndustry } from '@/lib/misc'
import { fieldLabel, readScheme, type SchemeField } from '@/lib/scheme'

const route = useRoute()
const router = useRouter()
const register = useRegister()
const { direction } = usePreferences()
const id = computed(() => String(route.params.id ?? ''))
const query = useQuery({ queryKey: ['assumption', id], queryFn: () => readLatestAssumption(id.value), retry: false })
const a = computed(() => query.data.value ?? null)
const duplicateOpen = ref(false)

const back = computed(() => {
  const last = readLastIndustry()
  const inds = a.value?.industries ?? []
  if (last && inds.some((i) => i.id === last || i.name === last)) return `/industries/${last}`
  if (inds.length) return `/industries/${inds[0].id}`
  return '/industries'
})

interface Row {
  field: SchemeField
  schema: string
}
const rows = computed<Row[]>(() => {
  const out: Row[] = []
  const seen = new Set<string>()
  for (const s of a.value?.schemas ?? []) {
    for (const f of readScheme(s.scheme).fields) {
      if (seen.has(f.key)) continue
      seen.add(f.key)
      out.push({ field: f, schema: s.name })
    }
  }
  return out
})
const manySchemas = computed(() => (a.value?.schemas.length ?? 0) > 1)
const state = computed(() => (a.value?.deleted ? t('detail.removed') : a.value?.archived ? t('detail.archived') : ''))

async function onDuplicated(newId: string) {
  try {
    await register.load(true)
  } catch (e) {
    reportError(e)
  }
  void router.push(`/assumptions/${newId}`)
}
</script>

<template>
  <PageHeader>
    <template #eyebrow>
      <div class="flex items-center gap-2">
        <Button as-child variant="link" size="sm" class="text-muted-foreground">
          <RouterLink :to="back" :aria-label="t('assumption.back')"><ChevronLeft class="rtl:rotate-180" />{{ t('assumption.back') }}</RouterLink>
        </Button>
        <Badge tone="primary">{{ t('assumption.badge') }}</Badge>
      </div>
    </template>
    <template #title>
      <span v-if="a" dir="auto" class="whitespace-pre-wrap"><LinkedText :text="a.assumption_text" /></span>
      <template v-else>{{ t('assumption.badge') }}</template>
    </template>
    <template v-if="a" #actions>
      <Button variant="secondary" @click="duplicateOpen = true"><Copy /> {{ t('assumption.duplicate') }}</Button>
    </template>
  </PageHeader>

  <div v-if="query.isPending.value" class="grid gap-4 lg:grid-cols-[22rem_1fr]">
    <Skeleton class="h-72" /><Skeleton class="h-72" />
  </div>
  <Card v-else-if="query.isError.value">
    <EmptyState :title="t('assumption.unreadable')" :description="query.error.value?.message">
      <template #icon><AlertCircle /></template>
    </EmptyState>
  </Card>
  <div v-else-if="a" class="grid items-start gap-4 lg:grid-cols-[22rem_1fr]">
    <Card>
      <CardHeader :title="t('assumption.facts')"><template #icon><ListTree /></template></CardHeader>
      <CardBody>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
          <dt class="text-muted-foreground">{{ t('column.industry') }}</dt>
          <dd class="flex flex-wrap gap-1">
            <Badge v-for="i in a.industries" :key="i.id" :tone="hashedTone(i.name)"><span dir="auto">{{ i.name }}</span></Badge>
            <span v-if="!a.industries.length">—</span>
          </dd>
          <dt class="text-muted-foreground">{{ t('column.proposingParty') }}</dt>
          <dd dir="auto"><LinkedText v-if="a.proposing_party" :text="a.proposing_party" /><template v-else>—</template></dd>
          <dt class="text-muted-foreground">{{ t('column.validationBy') }}</dt>
          <dd class="flex flex-wrap gap-1">
            <Badge v-for="v in a.validation_responsible_parties" :key="v"><span dir="auto">{{ v }}</span></Badge>
            <span v-if="!a.validation_responsible_parties.length">—</span>
          </dd>
          <dt class="text-muted-foreground">{{ t('column.tags') }}</dt>
          <dd class="flex flex-wrap gap-1">
            <Badge v-for="v in a.tags" :key="v" tone="outline"><span dir="auto">{{ v }}</span></Badge>
            <span v-if="!a.tags.length">—</span>
          </dd>
          <template v-if="state">
            <dt class="text-muted-foreground">{{ t('detail.state') }}</dt>
            <dd><Badge tone="danger">{{ state }}</Badge></dd>
          </template>
          <dt class="text-muted-foreground">{{ t('column.revision') }}</dt>
          <dd dir="auto">{{ a.revision }}<template v-if="a.revision_reason"> · {{ a.revision_reason }}</template></dd>
          <dt class="text-muted-foreground">{{ t('column.createdAt') }}</dt>
          <dd><span dir="ltr" class="tabular-nums">{{ formatDateTime(a.created_at) }}</span> · <span dir="auto">{{ a.creator }}</span></dd>
        </dl>
      </CardBody>
    </Card>
    <Card>
      <CardHeader :title="t('schemas.attributes')">
        <template #icon><TableProperties /></template>
        <template #description><Badge>{{ rows.length }}</Badge></template>
        <template #actions>
          <Button v-for="s in a.schemas" :key="s.id" as-child size="sm" variant="soft">
            <RouterLink :to="`/schemas/${s.id}`"><span dir="auto">{{ s.name }}</span></RouterLink>
          </Button>
        </template>
      </CardHeader>
      <EmptyState v-if="!rows.length" compact :title="t('schemas.noAttributes')" />
      <Table v-else :dir="direction">
        <thead>
          <tr>
            <TH>{{ t('assumption.attribute') }}</TH>
            <TH>{{ t('assumption.value') }}</TH>
            <TH v-if="manySchemas">{{ t('assumption.schema') }}</TH>
          </tr>
        </thead>
        <tbody>
          <TR v-for="r in rows" :key="r.field.key">
            <TD class="w-1/3">
              <div class="font-medium" dir="auto">{{ fieldLabel(r.field) }}</div>
              <code class="mono text-xs text-muted-foreground" dir="ltr">{{ r.field.key }}</code>
            </TD>
            <TD><ValueCell :field="r.field" :value="a.values[r.field.key]" /></TD>
            <TD v-if="manySchemas"><Badge :tone="hashedTone(r.schema)"><span dir="auto">{{ r.schema }}</span></Badge></TD>
          </TR>
        </tbody>
      </Table>
    </Card>
  </div>
  <CreateAssumptionDialog v-model:open="duplicateOpen" :source="a" @created="onDuplicated" />
</template>
