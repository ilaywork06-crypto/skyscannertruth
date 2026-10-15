<script setup lang="ts">
/** Platforms - table with an industry filter (platforms serving it), create / edit / rename / remove, drag to reorder. */
import { GripVertical, Pencil, Plus, Tags, Trash2 } from 'lucide-vue-next'
import {
  Button, Card, CardHeader, LinkedText, PageHeader, Select, TH, Tooltip, localName, nameColumnOrder, notify, reportError, splitNames,
  translate as t, useConfirm, type SelectOption,
} from '@truth-platform/ui'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, onMounted, ref } from 'vue'
import draggable from 'vuedraggable'
import { deletePlatform, invalidateTaxonomy, listPlatforms, servesIndustry, updatePlatform, useIndustries, type Industry, type Platform } from '@/api/taxonomy'
import { useSettingsOrder } from '@/composables/useSettingsOrder'
import IndustryChips from '@/components/settings/IndustryChips.vue'
import PlatformDialog from '@/components/settings/PlatformDialog.vue'
import SettingsTableState from '@/components/settings/SettingsTableState.vue'

const client = useQueryClient()
const confirm = useConfirm()
const { industries } = useIndustries()

const industry = ref<string | null>(null)
const platforms = ref<Platform[]>([])
const loading = ref(true)
const dialogOpen = ref(false)
const edited = ref<Platform | null>(null)

const industryOptions = computed<SelectOption<string>[]>(() => (industries.value as Industry[]).map((i) => ({ value: i.key, label: localName(i) })))
const sides = computed(() => nameColumnOrder())
const shown = computed({
  get: () => platforms.value.filter((p) => servesIndustry(p, industry.value)),
  set: (v: Platform[]) => {
    if (industry.value === null) platforms.value = v
  },
})
const canReorder = computed(() => industry.value === null && platforms.value.length > 1)

async function reload() {
  loading.value = true
  try {
    platforms.value = await listPlatforms()
  } catch (error) {
    reportError(error)
  } finally {
    loading.value = false
  }
}
onMounted(reload)

function openCreate() {
  edited.value = null
  dialogOpen.value = true
}
function openEdit(p: Platform) {
  edited.value = p
  dialogOpen.value = true
}
async function remove(p: Platform) {
  const ok = await confirm({ title: t('platforms.removeTitle'), description: t('platforms.removeBody'), confirmLabel: t('common.remove'), danger: true })
  if (!ok) return
  try {
    await deletePlatform(p.id)
    await invalidateTaxonomy(client)
    notify(t('common.removed'), 'success')
    await reload()
  } catch (error) {
    reportError(error)
  }
}
const order = useSettingsOrder<Platform>((id, o) => updatePlatform(id, { order: o }), async () => {
  await invalidateTaxonomy(client)
  await reload()
})
</script>

<template>
  <div>
    <PageHeader :title="t('app.platforms')" :description="t('settings.platformsDescription')">
      <template #actions>
        <Button variant="primary" @click="openCreate"><Plus /> {{ t('platforms.new') }}</Button>
      </template>
    </PageHeader>

    <Card>
      <CardHeader :title="t('app.platforms')" :description="t('settings.platformsCount', { count: shown.length })">
        <template #icon><Tags /></template>
        <template #actions>
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
              <TH>{{ t('common.description') }}</TH>
              <TH class="w-20" />
            </tr>
          </thead>
          <SettingsTableState :loading="loading" :empty="!shown.length" :columns="7" :title="t('settings.noPlatforms')">
            <template #icon><Tags /></template>
            <template #action><Button variant="soft" size="sm" @click="openCreate"><Plus /> {{ t('platforms.new') }}</Button></template>
          </SettingsTableState>
          <draggable
            v-if="!loading && shown.length"
            v-model="shown"
            tag="tbody"
            item-key="id"
            handle=".drag-handle"
            ghost-class="opacity-40"
            :disabled="!canReorder || order.saving.value"
            @end="order.persist(platforms)"
          >
            <template #item="{ element: p }">
              <tr class="transition-colors hover:bg-muted/40 [&:last-child>td]:border-0">
                <td class="border-b border-border/70 py-2.5">
                  <Tooltip :content="canReorder ? t('settings.dragToReorder') : t('settings.reorderNeedsAll')">
                    <span :class="['drag-handle grid size-6 place-items-center rounded text-muted-foreground', canReorder ? 'cursor-grab hover:bg-muted' : 'opacity-30']">
                      <GripVertical class="size-4" />
                    </span>
                  </Tooltip>
                </td>
                <td v-for="side in sides" :key="side" class="border-b border-border/70 px-3 py-2.5" :dir="side === 'english' ? 'ltr' : 'rtl'">
                  <span :class="side === sides[0] && 'font-medium'">{{ splitNames(p)[side] || '—' }}</span>
                </td>
                <td class="border-b border-border/70 px-3 py-2.5"><code class="mono rounded bg-muted px-1.5 py-0.5 text-xs" dir="ltr">{{ p.key }}</code></td>
                <td class="border-b border-border/70 px-3 py-2.5"><IndustryChips :keys="p.industries" /></td>
                <td class="max-w-[24rem] border-b border-border/70 px-3 py-2.5 text-[13px] text-muted-foreground" dir="auto">
                  <LinkedText v-if="p.description" :text="p.description" />
                  <template v-else>—</template>
                </td>
                <td class="border-b border-border/70 px-3 py-2.5">
                  <div class="flex justify-end gap-0.5">
                    <Button variant="ghost" size="icon-sm" :aria-label="t('platforms.edit')" :title="t('platforms.edit')" @click="openEdit(p)"><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" class="text-danger hover:bg-danger-soft" :aria-label="t('common.remove')" :title="t('common.remove')" @click="remove(p)"><Trash2 /></Button>
                  </div>
                </td>
              </tr>
            </template>
          </draggable>
        </table>
      </div>
    </Card>

    <PlatformDialog v-model:open="dialogOpen" :platform="edited" :taken="platforms.map((p) => p.key)" :default-industry="industry" @saved="reload" />
  </div>
</template>
