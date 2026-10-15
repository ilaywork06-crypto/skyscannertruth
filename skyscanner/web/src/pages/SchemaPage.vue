<script setup lang="ts">
/**
 * Schema - the declared fields. Section toggle (event fields / entity fields / additional data), industry
 * filter, a table of the declarations (drag to reorder when every industry is shown), create / edit / rename /
 * remove (with confirmation).
 */
import { Check, GripVertical, Pencil, Plus, TableProperties, Trash2 } from 'lucide-vue-next'
import {
  Badge, Button, Card, CardHeader, PageHeader, Segmented, Select, TH, Tooltip, joinIsolated, localName, nameColumnOrder, notify,
  reportError, splitNames, translate as t, useConfirm, type SelectOption,
} from '@truth-platform/ui'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import draggable from 'vuedraggable'
import {
  deleteField, invalidateTaxonomy, listEntityTypes, listEventTypes, listFields, updateField, useIndustries,
  type EntityType, type EventType, type FieldDefinition, type Industry,
} from '@/api/taxonomy'
import { useSettingsOrder } from '@/composables/useSettingsOrder'
import FieldDialog from '@/components/settings/FieldDialog.vue'
import IndustryChips from '@/components/settings/IndustryChips.vue'
import SettingsTableState from '@/components/settings/SettingsTableState.vue'
import { typeLabel, type FieldSection } from '@/components/settings/fieldTypes'

const client = useQueryClient()
const confirm = useConfirm()
const { industries, loaded: industriesLoaded } = useIndustries()

const section = ref<FieldSection>('event')
const industry = ref<string | null>(null)
const fields = ref<FieldDefinition[]>([])
const eventTypes = shallowRef<EventType[]>([])
const entityTypes = shallowRef<EntityType[]>([])
const loading = ref(true)
const dialogOpen = ref(false)
const edited = ref<FieldDefinition | null>(null)

const sectionOptions = computed(() => [
  { value: 'event' as const, label: t('schema.sectionEvent') },
  { value: 'own' as const, label: t('schema.sectionEntity') },
  { value: 'additional' as const, label: t('schema.sectionAdditional') },
])
const industryOptions = computed<SelectOption<string>[]>(() => (industries.value as Industry[]).map((i) => ({ value: i.key, label: localName(i) })))
const sides = computed(() => nameColumnOrder())
const isEvent = computed(() => section.value === 'event')
const canReorder = computed(() => industry.value === null && fields.value.length > 1)

let token = 0
async function reload() {
  const mine = ++token
  loading.value = true
  try {
    const scopes: (string | null)[] = industry.value === null ? [null, ...(industries.value as Industry[]).map((i) => i.key)] : [industry.value]
    const [lists, entities, events] = await Promise.all([
      Promise.all(
        scopes.map((scope) =>
          isEvent.value
            ? listFields({ scope: 'event', industry: scope, include_shared: true })
            : listFields({ scope: 'entity', industry: scope, include_shared: true, additional: section.value === 'additional' }),
        ),
      ),
      listEntityTypes(),
      listEventTypes(),
    ])
    if (mine !== token) return
    const unique = new Map<string, FieldDefinition>()
    lists.flat().forEach((f) => unique.set(f.id, f))
    fields.value = [...unique.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    entityTypes.value = entities
    eventTypes.value = events
  } catch (error) {
    reportError(error)
  } finally {
    if (mine === token) loading.value = false
  }
}

onMounted(() => {
  if (industriesLoaded.value) void reload()
})
watch(industriesLoaded, (ok) => ok && reload())
watch([section, industry], reload)

const names = (f: FieldDefinition) => splitNames({ name: f.name, name_he: f.metadata.name_he })
const eventTypeNames = (key: string) => joinIsolated(eventTypes.value.filter((x) => x.custom_fields.includes(key)).map((x) => localName(x)))
const entityTypeName = (key: string | null) => {
  if (!key) return t('schema.everyEntityType')
  const x = entityTypes.value.find((e) => e.key === key)
  return x ? localName(x) : key
}

function openCreate() {
  edited.value = null
  dialogOpen.value = true
}
function openEdit(f: FieldDefinition) {
  edited.value = f
  dialogOpen.value = true
}
async function remove(f: FieldDefinition) {
  const ok = await confirm({
    title: t('settings.removeFieldTitle'),
    description: t('settings.removeFieldBody', { name: localName({ name: f.name, name_he: f.metadata.name_he }) }),
    confirmLabel: t('common.remove'),
    danger: true,
  })
  if (!ok) return
  try {
    await deleteField(f.id)
    await invalidateTaxonomy(client)
    notify(t('common.removed'), 'success')
    await reload()
  } catch (error) {
    reportError(error)
  }
}

const order = useSettingsOrder<FieldDefinition>((id, o) => updateField(id, { order: o }), reload)
const columnCount = computed(() => 10)
</script>

<template>
  <div>
    <PageHeader :title="t('app.schema')" :description="t('settings.schemaDescription')">
      <template #actions>
        <Button variant="primary" @click="openCreate"><Plus /> {{ t('schema.new') }}</Button>
      </template>
    </PageHeader>

    <Card>
      <CardHeader :title="sectionOptions.find((s) => s.value === section)?.label" :description="t('settings.fieldsCount', { count: fields.length })">
        <template #icon><TableProperties /></template>
        <template #actions>
          <Segmented v-model="section" :options="sectionOptions" size="sm" />
          <Select v-model="industry" :options="industryOptions" :none-label="t('common.allIndustries')" size="sm" class="w-44" />
        </template>
      </CardHeader>
      <div class="w-full overflow-x-auto">
        <table class="w-full text-sm [&_td:first-child]:ps-5 [&_td:last-child]:pe-5 [&_th:first-child]:ps-5 [&_th:last-child]:pe-5">
          <thead>
            <tr>
              <TH class="w-8"><span class="sr-only">{{ t('settings.reorder') }}</span></TH>
              <TH v-for="side in sides" :key="side">{{ side === 'english' ? t('names.english') : t('names.hebrew') }}</TH>
              <TH>{{ t('names.key') }}</TH>
              <TH>{{ t('schema.type') }}</TH>
              <TH>{{ t('schema.industry') }}</TH>
              <TH>{{ isEvent ? t('schema.eventTypes') : t('schema.entityType') }}</TH>
              <TH class="text-center">{{ t('schema.required') }}</TH>
              <TH class="text-center">{{ t('schema.visible') }}</TH>
              <TH class="w-20" />
            </tr>
          </thead>
          <SettingsTableState :loading="loading" :empty="!fields.length" :columns="columnCount" :title="t('settings.noFields')" :description="t('settings.noFieldsHint')">
            <template #icon><TableProperties /></template>
            <template #action><Button variant="soft" size="sm" @click="openCreate"><Plus /> {{ t('schema.new') }}</Button></template>
          </SettingsTableState>
          <draggable
            v-if="!loading && fields.length"
            v-model="fields"
            tag="tbody"
            item-key="id"
            handle=".drag-handle"
            ghost-class="opacity-40"
            :disabled="!canReorder || order.saving.value"
            @end="order.persist(fields)"
          >
            <template #item="{ element: f }">
              <tr class="group transition-colors hover:bg-muted/40 [&:last-child>td]:border-0">
                <td class="border-b border-border/70 py-2.5">
                  <Tooltip :content="canReorder ? t('settings.dragToReorder') : t('settings.reorderNeedsAll')">
                    <span :class="['drag-handle grid size-6 place-items-center rounded text-muted-foreground', canReorder ? 'cursor-grab hover:bg-muted' : 'opacity-30']">
                      <GripVertical class="size-4" />
                    </span>
                  </Tooltip>
                </td>
                <td v-for="side in sides" :key="side" class="border-b border-border/70 px-3 py-2.5" :dir="side === 'english' ? 'ltr' : 'rtl'">
                  <span :class="side === sides[0] && 'font-medium'">{{ names(f)[side] || '—' }}</span>
                  <Badge v-if="f.discovered" tone="warning" class="ms-2">{{ t('attributes.notDeclared') }}</Badge>
                </td>
                <td class="border-b border-border/70 px-3 py-2.5"><code class="mono rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">{{ f.key }}</code></td>
                <td class="border-b border-border/70 px-3 py-2.5"><Badge tone="outline" class="mono">{{ typeLabel(f.type) }}{{ f.array ? '[]' : '' }}</Badge></td>
                <td class="border-b border-border/70 px-3 py-2.5"><IndustryChips :keys="[f.industry]" /></td>
                <td class="border-b border-border/70 px-3 py-2.5 text-[13px] text-muted-foreground" dir="auto">
                  {{ isEvent ? eventTypeNames(f.key) || '—' : entityTypeName(f.entity_type) }}
                </td>
                <td class="border-b border-border/70 px-3 py-2.5 text-center"><Check v-if="f.required" class="mx-auto size-4 text-success" :aria-label="t('common.yes')" /></td>
                <td class="border-b border-border/70 px-3 py-2.5 text-center"><Check v-if="f.visible" class="mx-auto size-4 text-success" :aria-label="t('common.yes')" /></td>
                <td class="border-b border-border/70 px-3 py-2.5">
                  <div class="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon-sm" :aria-label="t('schema.edit')" :title="t('schema.edit')" @click="openEdit(f)"><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" class="text-danger hover:bg-danger-soft" :aria-label="t('common.remove')" :title="t('common.remove')" @click="remove(f)"><Trash2 /></Button>
                  </div>
                </td>
              </tr>
            </template>
          </draggable>
        </table>
      </div>
    </Card>

    <FieldDialog
      v-model:open="dialogOpen"
      :field="edited"
      :section="section"
      :industry="industry"
      :fields="fields"
      :event-types="eventTypes"
      :entity-types="entityTypes"
      @saved="reload"
    />
  </div>
</template>
