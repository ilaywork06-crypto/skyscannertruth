<script setup lang="ts">
/**
 * One event (spec §6): its brief and generated title, the facts strip, information, declared attributes,
 * every file (tree + preview), and its entities by type. Edit, add files, history and delete from the header.
 */
import {
  ArrowLeft, Boxes, CalendarDays, Download, FileSearch, FileText, FolderArchive, History, Info, Pencil, Plus, Tag, Trash2, Upload,
} from 'lucide-vue-next'
import {
  Badge, Button, Card, CardBody, CardHeader, EMPTY_PLACEHOLDER, EmptyState, LinkedText, PageHeader, Skeleton, Tooltip, formatDate, formatDateTime,
  hashedTone, localName, notify, reportError, translate as t, useConfirm, usePreferences, valueLabel,
} from '@truth-platform/ui'
import type { GeneratedGridConfiguration, TaxonomyItem } from '@truth-platform/grid'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, defineAsyncComponent, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { downloadArchive, downloadArtifact, downloadEntityArchive, type Artifact } from '@/api/artifacts'
import { deleteEvent, eventToRow, readEvent, type EntityResponse, type EventDetail } from '@/api/events'
import { exportEventFiles, readEntityColumns, readEventColumns } from '@/api/grid'
import { TAXONOMY_KEYS, listEventTypes, listPlatforms, useIndustries, type EventType, type Platform } from '@/api/taxonomy'
import { provideSearchTerm } from '@/composables/useSearchTerm'
import { entityTypeLabels, localised } from '@/lib/columns'
import { askedFieldKeys, attributeColumns, buildEventTitle, eventAttributeColumnsFor } from '@/lib/events'
import { iconFor } from '@/lib/icons'
import AddEntityDialog from '@/components/event/AddEntityDialog.vue'
import AttributesTable from '@/components/event/AttributesTable.vue'
import EditEventDialog from '@/components/event/EditEventDialog.vue'
import EntityTable from '@/components/event/EntityTable.vue'
import EventFileTree from '@/components/event/EventFileTree.vue'
import RevisionHistoryDialog from '@/components/event/RevisionHistoryDialog.vue'
import FilePreview from '@/components/viewer/FilePreview.vue'
import FileViewerDialog from '@/components/viewer/FileViewerDialog.vue'

// The upload dialog belongs to another part of the client; it is wired in when present.
const uploadDialogs = import.meta.glob('../components/uploads/UploadDialog.vue')
const UploadDialog = uploadDialogs['../components/uploads/UploadDialog.vue']
  ? defineAsyncComponent(uploadDialogs['../components/uploads/UploadDialog.vue'] as () => Promise<{ default: object }>)
  : null

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const queryClient = useQueryClient()
const { language } = usePreferences()
const hebrew = computed(() => language.value === 'he')
const { industries, find: findIndustry } = useIndustries()
provideSearchTerm(computed(() => ''))

const id = computed(() => String(route.params.id ?? ''))
const event = ref<EventDetail | null>(null)
const failure = ref('')
const loading = ref(false)
const entityConfig = shallowRef<GeneratedGridConfiguration | null>(null)
const eventConfig = shallowRef<GeneratedGridConfiguration | null>(null)
const eventTypes = ref<EventType[]>([])
const platforms = ref<Platform[]>([])
const activeTab = ref('')
const previewed = ref<Artifact | null>(null)

async function reload() {
  loading.value = true
  failure.value = ''
  try {
    const e = await readEvent(id.value)
    const [ec, evc, types, plats] = await Promise.all([
      readEntityColumns(e.industry),
      readEventColumns([e.industry]),
      queryClient.fetchQuery({ queryKey: TAXONOMY_KEYS.eventTypes(null), queryFn: () => listEventTypes() }),
      queryClient.fetchQuery({ queryKey: TAXONOMY_KEYS.platforms(null), queryFn: () => listPlatforms() }),
    ])
    event.value = e
    entityConfig.value = ec
    eventConfig.value = evc
    eventTypes.value = types
    platforms.value = plats
    if (previewed.value && !allFiles(e).some((f) => f.id === previewed.value!.id)) previewed.value = null
  } catch (err) {
    failure.value = err instanceof Error ? err.message : t('errors.generic')
    reportError(err)
  } finally {
    loading.value = false
  }
}
watch(id, () => {
  event.value = null
  previewed.value = null
  void reload()
}, { immediate: true })

const allFiles = (e: EventDetail) => [...e.additional_files, ...e.objects.flatMap((o) => [...o.raw_files, ...o.parsed_files, ...o.parsed_additional_files])]

/* ---------------- names in the page's language */
const entityColumns = computed(() => (entityConfig.value ? localised(entityConfig.value, hebrew.value) : null))
const eventColumns = computed(() => (eventConfig.value ? localised(eventConfig.value, hebrew.value) : null))
const typeLabels = computed(() => entityTypeLabels(entityColumns.value, hebrew.value))
const typeLabel = (name: string) => typeLabels.value.get(name) ?? name
const taxonomy = computed<TaxonomyItem[]>(() => industries.value.map((i) => ({ key: i.key, name: i.name, name_he: i.name_he, icon: i.icon, color: '' })))

const ownTypes = computed(() => {
  const names = new Set((event.value?.event_type ?? []).map((x) => x.name))
  return eventTypes.value.filter((x) => names.has(x.name))
})
const typeNames = computed(() => (event.value?.event_type ?? []).map((x) => {
  const declared = eventTypes.value.find((d) => d.name === x.name)
  return declared ? localName(declared) : x.name
}))
const platformNames = computed(() => (event.value?.platforms ?? []).map((k) => {
  const p = platforms.value.find((x) => x.key === k)
  return p ? localName(p) : k
}))
const industry = computed(() => findIndustry(event.value?.industry))
const industryName = computed(() => (industry.value ? localName(industry.value) : event.value?.industry ?? ''))
const title = computed(() => {
  const e = event.value
  if (!e) return ''
  void language.value
  return buildEventTitle({ typeNames: typeNames.value, platformNames: platformNames.value, industryName: industryName.value, day: formatDate(e.event_date ?? e.created_at) })
})

const row = computed(() => (event.value ? eventToRow(event.value) : null))
const attributes = computed(() => {
  if (!eventColumns.value || !row.value) return []
  const all = attributeColumns(eventColumns.value.columns, row.value)
  return eventAttributeColumnsFor(all, askedFieldKeys(ownTypes.value), row.value.data as Record<string, never>)
})
const fileCount = computed(() => (event.value ? allFiles(event.value).length : 0))

/* ---------------- entities by type */
const groups = computed(() => {
  const map = new Map<string, EntityResponse[]>()
  for (const o of event.value?.objects ?? []) {
    const k = o.object_type?.name ?? ''
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(o)
  }
  return [...map.entries()].map(([name, entities]) => ({ name, label: typeLabel(name), entities }))
})
watch(groups, (g) => {
  if (!g.some((x) => x.name === activeTab.value)) activeTab.value = g[0]?.name ?? ''
})
const activeEntities = computed(() => groups.value.find((g) => g.name === activeTab.value)?.entities ?? [])

/* ---------------- actions */
const editOpen = ref(false)
const historyOpen = ref(false)
const uploadOpen = ref(false)
const entityOpen = ref(false)
const editingEntity = ref<EntityResponse | null>(null)
const viewerOpen = ref(false)
const viewed = ref<Artifact | null>(null)
const packing = ref(false)
const entityPacking = ref(false)
const historyEntity = ref<EntityResponse | null>(null)
const historyTitle = computed(() => t('event.historyOf', { name: historyEntity.value?.name ?? event.value?.name ?? '' }))

function openViewer(a: Artifact) {
  viewed.value = a
  viewerOpen.value = true
}
function addEntity() {
  editingEntity.value = null
  entityOpen.value = true
}
function editEntity(e: EntityResponse) {
  editingEntity.value = e
  entityOpen.value = true
}
function showHistory(entity: EntityResponse | null) {
  historyEntity.value = entity
  historyOpen.value = true
}
async function downloadAll() {
  const e = event.value
  if (!e) return
  packing.value = true
  try {
    const manifest = await exportEventFiles({
      search: null, industry: e.industry, industries: [], parse_state: 'all', filters: [], sort: [], page: 1, page_size: 1, columns: [], event_ids: [e.id],
    })
    if (!manifest.entries.length) throw new Error(t('export.noFiles'))
    await downloadArchive(manifest)
    notify(t('inventory.packed'))
  } catch (err) {
    reportError(err)
  } finally {
    packing.value = false
  }
}
async function archiveEntities(list: EntityResponse[]) {
  const e = event.value
  if (!e) return
  entityPacking.value = true
  try {
    await downloadEntityArchive(e.event_id, e.name, list.map((x) => ({ name: x.name, typeName: x.object_type?.name ?? '', raw_files: x.raw_files, parsed_files: x.parsed_files, parsed_additional_files: x.parsed_additional_files })))
    notify(t('inventory.packed'))
  } catch (err) {
    reportError(err)
  } finally {
    entityPacking.value = false
  }
}
async function remove() {
  const e = event.value
  if (!e) return
  const ok = await confirm({ title: t('event.deleteTitle'), description: t('event.deleteBody'), confirmLabel: t('event.delete'), danger: true })
  if (!ok) return
  try {
    await deleteEvent(e.id)
    notify(t('event.deleted'))
    void router.push('/events')
  } catch (err) {
    reportError(err)
  }
}
function onSaved(updated: EventDetail) {
  event.value = updated
}
</script>

<template>
  <div>
    <Button variant="ghost" size="sm" class="-ms-3 mb-3 text-muted-foreground" :aria-label="t('event.back')" @click="router.push('/events')">
      <ArrowLeft class="rtl:rotate-180" /> {{ t('nav.inventory') }}
    </Button>

    <template v-if="!event">
      <EmptyState v-if="failure && !loading" :title="t('event.notLoaded')" :description="failure">
        <template #icon><FileSearch /></template>
        <template #action><Button variant="secondary" @click="reload">{{ t('common.retry') }}</Button></template>
      </EmptyState>
      <div v-else class="flex flex-col gap-4">
        <Skeleton class="h-6 w-24" />
        <Skeleton class="h-9 w-2/3" />
        <Skeleton class="h-5 w-1/2" />
        <Skeleton class="mt-4 h-24" />
        <Skeleton class="h-64" />
      </div>
    </template>

    <template v-else>
      <PageHeader>
        <template #eyebrow><Badge tone="primary">{{ t('event.badge') }} #{{ event.event_id }}</Badge></template>
        <template #title><span dir="auto"><LinkedText :text="event.name || EMPTY_PLACEHOLDER" /></span></template>
        <template #description><span dir="auto">{{ title }}</span></template>
        <template #actions>
          <Button variant="secondary" @click="showHistory(null)"><History /> {{ t('event.history') }}</Button>
          <Button v-if="UploadDialog" variant="secondary" @click="uploadOpen = true"><Upload /> {{ t('event.addFiles') }}</Button>
          <Tooltip :content="t('event.delete')">
            <Button variant="danger-soft" size="icon" :aria-label="t('event.delete')" @click="remove"><Trash2 /></Button>
          </Tooltip>
          <Button variant="primary" @click="editOpen = true"><Pencil /> {{ t('event.edit') }}</Button>
        </template>
      </PageHeader>

      <!-- Facts -->
      <Card class="mb-6">
        <dl class="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
          <div>
            <dt class="fact-label">{{ t('event.id') }}</dt>
            <dd class="mt-1 text-sm font-medium tabular-nums">{{ event.event_id }}</dd>
          </div>
          <div>
            <dt class="fact-label">{{ t('event.type') }}</dt>
            <dd class="mt-1 flex flex-wrap gap-1">
              <Badge v-for="(n, i) in typeNames" :key="i" :tone="hashedTone(event.event_type[i]?.name ?? n)"><span dir="auto">{{ n }}</span></Badge>
              <span v-if="!typeNames.length" class="text-sm text-muted-foreground">{{ EMPTY_PLACEHOLDER }}</span>
            </dd>
          </div>
          <div>
            <dt class="fact-label">{{ t('event.date') }}</dt>
            <dd class="mt-1 flex items-center gap-1.5 text-sm tabular-nums" dir="ltr"><CalendarDays class="size-4 text-muted-foreground" />{{ formatDate(event.event_date) }}</dd>
          </div>
          <div>
            <dt class="fact-label">{{ t('event.industry') }}</dt>
            <dd class="mt-1">
              <Badge><component :is="iconFor(industry?.icon)" /><span dir="auto">{{ industryName }}</span></Badge>
            </dd>
          </div>
          <div v-if="event.platforms.length">
            <dt class="fact-label">{{ t('event.platform') }}</dt>
            <dd class="mt-1 flex flex-wrap gap-1"><Badge v-for="(p, i) in platformNames" :key="i"><span dir="auto">{{ p }}</span></Badge></dd>
          </div>
          <div v-if="event.experiment_result">
            <dt class="fact-label">{{ t('event.result') }}</dt>
            <dd class="mt-1"><Badge>{{ valueLabel(event.experiment_result) }}</Badge></dd>
          </div>
          <div class="sm:text-end">
            <dt class="fact-label">{{ t('event.createdAt') }}</dt>
            <dd class="mt-1 text-sm tabular-nums text-muted-foreground" dir="ltr">{{ formatDateTime(event.created_at) }}</dd>
          </div>
          <div class="sm:text-end">
            <dt class="fact-label">{{ t('event.updatedAt') }}</dt>
            <dd class="mt-1 text-sm tabular-nums text-muted-foreground" dir="ltr">{{ formatDateTime(event.updated_at) }}</dd>
          </div>
        </dl>
      </Card>

      <div class="flex flex-col gap-6">
        <Card v-if="event.notes.trim()">
          <CardHeader :title="t('event.information')"><template #icon><Info /></template></CardHeader>
          <CardBody><p class="whitespace-pre-line text-sm leading-relaxed" dir="auto"><LinkedText :text="event.notes" /></p></CardBody>
        </Card>

        <Card v-if="attributes.length && row">
          <CardHeader :title="t('detail.attributes')"><template #icon><Tag /></template></CardHeader>
          <CardBody>
            <AttributesTable :columns="attributes" :row="row" :taxonomy="taxonomy" @open="openViewer" @download="downloadArtifact" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader :title="t('event.files')">
            <template #icon><FileText /></template>
            <template #title>{{ t('event.files') }} <span class="ms-1 rounded-full bg-subtle px-1.5 text-[11px] font-normal leading-5 text-muted-foreground tabular-nums">{{ fileCount }}</span></template>
            <template #actions>
              <Button size="sm" variant="secondary" :loading="packing" :disabled="!fileCount" @click="downloadAll"><FolderArchive /> {{ t('event.downloadAll') }}</Button>
            </template>
          </CardHeader>
          <CardBody>
            <div class="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
              <div class="max-h-[70vh] overflow-y-auto rounded-xl border border-border p-2">
                <EventFileTree :event="event" :type-label="typeLabel" :active-id="previewed?.id" @open="previewed = $event" @download="downloadArtifact" />
              </div>
              <div class="min-w-0 rounded-xl border border-border p-3">
                <template v-if="previewed">
                  <div class="mb-3 flex items-center gap-2">
                    <span class="min-w-0 flex-1 truncate text-[13px] font-medium" dir="auto" :title="previewed.name">{{ previewed.name }}</span>
                    <Button size="xs" variant="ghost" @click="downloadArtifact(previewed)"><Download /> {{ t('files.download') }}</Button>
                  </div>
                  <FilePreview :artifact="previewed" compact @download="downloadArtifact" />
                </template>
                <EmptyState v-else compact :title="t('event.pickFile')">
                  <template #icon><FileSearch /></template>
                </EmptyState>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader :title="t('event.entities')">
            <template #icon><Boxes /></template>
            <template #actions><Button size="sm" variant="soft" @click="addEntity"><Plus /> {{ t('detail.addEntity') }}</Button></template>
          </CardHeader>
          <CardBody>
            <EmptyState v-if="!groups.length" compact :title="t('event.noEntities')">
              <template #icon><Boxes /></template>
            </EmptyState>
            <template v-else>
              <div class="mb-4 flex flex-wrap gap-1 border-b border-border" role="tablist">
                <button
                  v-for="g in groups"
                  :key="g.name"
                  type="button"
                  role="tab"
                  :aria-selected="g.name === activeTab"
                  :class="[
                    '-mb-px flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors',
                    g.name === activeTab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  ]"
                  @click="activeTab = g.name"
                >
                  <span dir="auto">{{ g.label }}</span>
                  <span class="rounded-full bg-subtle px-1.5 text-[11px] leading-5 text-muted-foreground tabular-nums">{{ g.entities.length }}</span>
                </button>
              </div>
              <EntityTable
                v-if="entityColumns"
                :columns="entityColumns.columns"
                :entities="activeEntities"
                :taxonomy="taxonomy"
                :downloading="entityPacking"
                show-history
                @open="openViewer"
                @download="downloadArtifact"
                @edit="editEntity"
                @history="showHistory"
                @archive="archiveEntities"
              />
            </template>
          </CardBody>
        </Card>
      </div>

      <EditEventDialog v-model:open="editOpen" :event="event" @saved="onSaved" />
      <AddEntityDialog v-model:open="entityOpen" :event="event" :entity="editingEntity" @saved="reload" />
      <RevisionHistoryDialog v-model:open="historyOpen" :event-id="event.id" :entity-id="historyEntity?.id ?? null" :title="historyTitle" />
      <component :is="UploadDialog" v-if="UploadDialog" v-model:open="uploadOpen" :event-id="event.id" @done="reload" />
    </template>
    <FileViewerDialog v-model:open="viewerOpen" :artifact="viewed" />
  </div>
</template>

<style scoped>
.fact-label { font-size: 11px; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase; color: rgb(var(--muted-foreground)); }
</style>
