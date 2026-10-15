<script setup lang="ts">
/** Types - event types and entity types: table, industry filter, create / edit / rename / remove, drag to reorder. */
import { GripVertical, Pencil, Plus, Shapes, Trash2 } from 'lucide-vue-next'
import {
  Badge, Button, Card, CardHeader, PageHeader, Segmented, Select, TH, Tooltip, hashedTone, joinIsolated, localName, nameColumnOrder,
  notify, reportError, splitNames, translate as t, useConfirm, type SelectOption,
} from '@truth-platform/ui'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import draggable from 'vuedraggable'
import {
  deleteType, invalidateTaxonomy, listEntityTypes, listEventTypes, listFields, updateEntityType, updateEventType, useIndustries,
  type EntityType, type EventType, type FieldDefinition, type Industry,
} from '@/api/taxonomy'
import { useSettingsOrder } from '@/composables/useSettingsOrder'
import IndustryChips from '@/components/settings/IndustryChips.vue'
import MdiIcon from '@/components/settings/MdiIcon.vue'
import SettingsTableState from '@/components/settings/SettingsTableState.vue'
import TypeDialog, { type TypeKind } from '@/components/settings/TypeDialog.vue'

type AnyType = EventType | EntityType

const client = useQueryClient()
const confirm = useConfirm()
const { industries } = useIndustries()

const kind = ref<TypeKind>('event')
const industry = ref<string | null>(null)
const types = ref<AnyType[]>([])
const eventFields = shallowRef<FieldDefinition[]>([])
const loading = ref(true)
const dialogOpen = ref(false)
const dialogKind = ref<TypeKind>('event')
const edited = ref<AnyType | null>(null)

const kindOptions = computed(() => [
  { value: 'event' as const, label: t('types.event') },
  { value: 'entity' as const, label: t('types.entity') },
])
const industryOptions = computed<SelectOption<string>[]>(() => (industries.value as Industry[]).map((i) => ({ value: i.key, label: localName(i) })))
const sides = computed(() => nameColumnOrder())
const canReorder = computed(() => industry.value === null && types.value.length > 1)

let token = 0
async function reload() {
  const mine = ++token
  loading.value = true
  try {
    const [list, fields] = await Promise.all([
      kind.value === 'event' ? listEventTypes(industry.value) : listEntityTypes(industry.value),
      // Name the custom fields of every industry (the original read only the filter's own, so an industry's
      // field showed as its bare key on the "All industries" view).
      Promise.all(
        (industry.value === null ? [null, ...(industries.value as Industry[]).map((i) => i.key)] : [industry.value]).map((scope) =>
          listFields({ scope: 'event', industry: scope, include_shared: true }),
        ),
      ).then((lists) => [...new Map(lists.flat().map((f) => [f.id, f])).values()]),
    ])
    if (mine !== token) return
    types.value = list
    eventFields.value = fields
  } catch (error) {
    reportError(error)
  } finally {
    if (mine === token) loading.value = false
  }
}
onMounted(reload)
watch([kind, industry], reload)
watch(() => (industries.value as Industry[]).length, reload)

const fieldName = (key: string) => {
  const f = eventFields.value.find((x) => x.key === key)
  return f ? localName({ name: f.name, name_he: f.metadata.name_he }) : key
}
const asksFor = (x: AnyType) => {
  const ev = x as EventType
  return joinIsolated([...(ev.fields ?? []).map((f) => t(`types.field.${f}`)), ...(ev.custom_fields ?? []).map(fieldName)])
}

function openCreate() {
  edited.value = null
  dialogKind.value = kind.value
  dialogOpen.value = true
}
function openEdit(x: AnyType) {
  edited.value = x
  dialogKind.value = kind.value
  dialogOpen.value = true
}
function onSaved(savedKind: TypeKind) {
  if (kind.value !== savedKind) kind.value = savedKind
  else void reload()
}
async function remove(x: AnyType) {
  const ok = await confirm({
    title: t('settings.removeTypeTitle'),
    description: t('settings.removeTypeBody', { name: localName(x) }),
    confirmLabel: t('common.remove'),
    danger: true,
  })
  if (!ok) return
  try {
    await deleteType(x.id)
    await invalidateTaxonomy(client)
    notify(t('common.removed'), 'success')
    await reload()
  } catch (error) {
    reportError(error)
  }
}

const order = useSettingsOrder<AnyType>(
  (id, o) => (kind.value === 'event' ? updateEventType(id, { order: o }) : updateEntityType(id, { order: o })),
  async () => {
    await invalidateTaxonomy(client)
    await reload()
  },
)
const columnCount = computed(() => (kind.value === 'event' ? 7 : 7))
const takenKeys = computed(() => types.value.map((x) => x.key))
</script>

<template>
  <div>
    <PageHeader :title="t('app.types')" :description="t('settings.typesDescription')">
      <template #actions>
        <Button variant="primary" @click="openCreate"><Plus /> {{ kind === 'event' ? t('types.newEvent') : t('types.newEntity') }}</Button>
      </template>
    </PageHeader>

    <Card>
      <CardHeader :title="kind === 'event' ? t('types.event') : t('types.entity')" :description="t('settings.typesCount', { count: types.length })">
        <template #icon><Shapes /></template>
        <template #actions>
          <Segmented v-model="kind" :options="kindOptions" size="sm" />
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
              <TH>{{ t('settings.industries') }}</TH>
              <TH v-if="kind === 'event'">{{ t('types.asksFor') }}</TH>
              <TH v-else>{{ t('icons.label') }}</TH>
              <TH class="w-20" />
            </tr>
          </thead>
          <SettingsTableState :loading="loading" :empty="!types.length" :columns="columnCount" :title="t('settings.noTypes')">
            <template #icon><Shapes /></template>
            <template #action><Button variant="soft" size="sm" @click="openCreate"><Plus /> {{ kind === 'event' ? t('types.newEvent') : t('types.newEntity') }}</Button></template>
          </SettingsTableState>
          <draggable
            v-if="!loading && types.length"
            v-model="types"
            tag="tbody"
            item-key="id"
            handle=".drag-handle"
            ghost-class="opacity-40"
            :disabled="!canReorder || order.saving.value"
            @end="order.persist(types)"
          >
            <template #item="{ element: x }">
              <tr class="transition-colors hover:bg-muted/40 [&:last-child>td]:border-0">
                <td class="border-b border-border/70 py-2.5">
                  <Tooltip :content="canReorder ? t('settings.dragToReorder') : t('settings.reorderNeedsAll')">
                    <span :class="['drag-handle grid size-6 place-items-center rounded text-muted-foreground', canReorder ? 'cursor-grab hover:bg-muted' : 'opacity-30']">
                      <GripVertical class="size-4" />
                    </span>
                  </Tooltip>
                </td>
                <td v-for="side in sides" :key="side" class="border-b border-border/70 px-3 py-2.5" :dir="side === 'english' ? 'ltr' : 'rtl'">
                  <template v-if="splitNames(x)[side]">
                    <Badge v-if="kind === 'event'" :tone="hashedTone(x.name)">{{ splitNames(x)[side] }}</Badge>
                    <span v-else :class="side === sides[0] && 'font-medium'">{{ splitNames(x)[side] }}</span>
                  </template>
                  <span v-else class="text-muted-foreground">—</span>
                </td>
                <td class="border-b border-border/70 px-3 py-2.5"><code class="mono rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">{{ x.key }}</code></td>
                <td class="border-b border-border/70 px-3 py-2.5"><IndustryChips :keys="x.industries" /></td>
                <td v-if="kind === 'event'" class="max-w-[22rem] border-b border-border/70 px-3 py-2.5 text-[13px] text-muted-foreground" dir="auto">{{ asksFor(x) || '—' }}</td>
                <td v-else class="border-b border-border/70 px-3 py-2.5">
                  <span class="inline-flex items-center gap-2 text-muted-foreground">
                    <MdiIcon :name="(x as EntityType).icon || 'mdi-chart-timeline-variant'" class="size-4" />
                    <code class="mono text-xs" dir="ltr">{{ (x as EntityType).icon || '—' }}</code>
                  </span>
                </td>
                <td class="border-b border-border/70 px-3 py-2.5">
                  <div class="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon-sm" :aria-label="t('types.edit')" :title="t('types.edit')" @click="openEdit(x)"><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" class="text-danger hover:bg-danger-soft" :aria-label="t('common.remove')" :title="t('common.remove')" @click="remove(x)"><Trash2 /></Button>
                  </div>
                </td>
              </tr>
            </template>
          </draggable>
        </table>
      </div>
    </Card>

    <TypeDialog
      v-model:open="dialogOpen"
      :kind="dialogKind"
      :type="edited"
      :taken="takenKeys"
      :event-fields="eventFields"
      :default-industry="industry"
      @saved="onSaved"
    />
  </div>
</template>
