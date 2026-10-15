<script setup lang="ts">
/**
 * What an expanded inventory row shows (spec §4.13): the event's declared attributes, then its entities grouped
 * by type - each group with its own table and an Add button.
 */
import { Plus } from 'lucide-vue-next'
import { Button, Spinner, notify, reportError, translate as t, usePreferences } from '@truth-platform/ui'
import type { GeneratedGridConfiguration, GridRow, TaxonomyItem } from '@truth-platform/grid'
import { computed, ref, shallowRef, watch } from 'vue'
import { downloadArtifact, downloadEntityArchive, type Artifact } from '@/api/artifacts'
import { listEntities, readEvent, type EntityResponse, type EventDetail } from '@/api/events'
import { readEntityColumns, readEventColumns } from '@/api/grid'
import { listEventTypes, type EventType } from '@/api/taxonomy'
import { entityTypeLabels, localised } from '@/lib/columns'
import { askedFieldKeys, attributeColumns, eventAttributeColumnsFor } from '@/lib/events'
import AddEntityDialog from '@/components/event/AddEntityDialog.vue'
import AttributesTable from '@/components/event/AttributesTable.vue'
import EntityTable from '@/components/event/EntityTable.vue'

const props = defineProps<{ eventId: string; eventRow: GridRow | undefined; taxonomy: TaxonomyItem[] }>()
const emit = defineEmits<{ open: [artifact: Artifact] }>()
const { language } = usePreferences()
const hebrew = computed(() => language.value === 'he')

const loading = ref(false)
const entities = ref<EntityResponse[]>([])
const eventConfig = shallowRef<GeneratedGridConfiguration | null>(null)
const eventTypes = ref<EventType[]>([])
const entityConfigs = shallowRef<Map<string, GeneratedGridConfiguration>>(new Map())
const anyEntityConfig = shallowRef<GeneratedGridConfiguration | null>(null)
const industry = computed(() => String(props.eventRow?.industry ?? '') || null)

async function load() {
  loading.value = true
  try {
    entities.value = await listEntities(props.eventId)
    const keys = [...new Set(entities.value.map((e) => e.object_type_key).filter(Boolean))]
    const [ec, types, generic, ...perType] = await Promise.all([
      readEventColumns(industry.value ? [industry.value] : []),
      listEventTypes(),
      readEntityColumns(industry.value),
      ...keys.map((k) => readEntityColumns(industry.value, k)),
    ])
    eventConfig.value = ec
    eventTypes.value = types
    anyEntityConfig.value = generic
    entityConfigs.value = new Map(keys.map((k, i) => [k, perType[i]]))
  } catch (e) {
    reportError(e)
  } finally {
    loading.value = false
  }
}
watch(() => props.eventId, load, { immediate: true })

const labels = computed(() => entityTypeLabels(anyEntityConfig.value ? localised(anyEntityConfig.value, hebrew.value) : null, hebrew.value))
const attributes = computed(() => {
  if (!eventConfig.value || !props.eventRow) return []
  const cols = localised(eventConfig.value, hebrew.value).columns
  const keys = new Set((props.eventRow.event_type_keys as string[] | undefined) ?? [])
  const own = eventTypes.value.filter((x) => keys.has(x.key))
  return eventAttributeColumnsFor(attributeColumns(cols, props.eventRow), askedFieldKeys(own), props.eventRow.data as Record<string, never>)
})
const groups = computed(() => {
  const map = new Map<string, EntityResponse[]>()
  for (const e of entities.value) {
    const k = e.object_type_key || e.object_type?.name || ''
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(e)
  }
  return [...map.entries()].map(([key, list]) => {
    const name = list[0]?.object_type?.name ?? key
    const config = entityConfigs.value.get(key) ?? anyEntityConfig.value
    return { key, label: labels.value.get(name) ?? name, list, columns: config ? localised(config, hebrew.value).columns : [] }
  })
})

/* -------- add / edit needs the whole event */
const fullEvent = ref<EventDetail | null>(null)
const dialogOpen = ref(false)
const editing = ref<EntityResponse | null>(null)
const presetType = ref<string | null>(null)
async function openDialog(entity: EntityResponse | null, typeKey: string | null) {
  try {
    fullEvent.value = fullEvent.value ?? (await readEvent(props.eventId))
    editing.value = entity
    presetType.value = typeKey
    dialogOpen.value = true
  } catch (e) {
    reportError(e)
  }
}
async function onSaved() {
  fullEvent.value = null
  await load()
}

const packing = ref(false)
async function archive(list: EntityResponse[]) {
  packing.value = true
  try {
    const row = props.eventRow
    await downloadEntityArchive(String(row?.event_id ?? ''), String(row?.name ?? ''), list.map((x) => ({
      name: x.name, typeName: x.object_type?.name ?? '', raw_files: x.raw_files, parsed_files: x.parsed_files, parsed_additional_files: x.parsed_additional_files,
    })))
    notify(t('inventory.packed'))
  } catch (e) {
    reportError(e)
  } finally {
    packing.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-5 px-5 py-4">
    <div v-if="loading && !entities.length && !eventConfig" class="grid min-h-32 place-items-center"><Spinner /></div>
    <template v-else>
      <AttributesTable
        v-if="attributes.length && eventRow"
        :columns="attributes"
        :row="eventRow"
        :taxonomy="taxonomy"
        :title="t('detail.attributes')"
        @open="emit('open', $event)"
        @download="downloadArtifact"
      />
      <section v-for="g in groups" :key="g.key" class="flex flex-col gap-2">
        <header class="flex items-center gap-2">
          <h4 class="text-[13px] font-semibold" dir="auto">{{ g.label }}</h4>
          <span class="rounded-full bg-subtle px-1.5 text-[11px] leading-5 text-muted-foreground tabular-nums">{{ g.list.length }}</span>
          <Button size="xs" variant="soft" class="ms-auto" @click="openDialog(null, g.key)"><Plus /> {{ t('detail.addEntity') }}</Button>
        </header>
        <EntityTable
          :columns="g.columns"
          :entities="g.list"
          :taxonomy="taxonomy"
          :downloading="packing"
          @open="emit('open', $event)"
          @download="downloadArtifact"
          @edit="(e) => openDialog(e, null)"
          @archive="archive"
        />
      </section>
      <div v-if="!groups.length">
        <Button size="sm" variant="soft" @click="openDialog(null, null)"><Plus /> {{ t('detail.addEntity') }}</Button>
      </div>
    </template>
    <AddEntityDialog v-model:open="dialogOpen" :event="fullEvent" :entity="editing" :default-type-key="presetType" @saved="onSaved" />
  </div>
</template>
