<script setup lang="ts">
/**
 * Industries - a card per industry (opens its inventory), create and edit (industries are never removed or
 * renamed). Dragging the cards sets the order of the industry tabs of the inventory (kept in this browser,
 * `skyscanner.industry-tabs.order`, as the tabs themselves do).
 */
import { Building2, CalendarDays, GripVertical, Pencil, Plus } from 'lucide-vue-next'
import { Badge, Button, EmptyState, LinkedText, PageHeader, Skeleton, Tooltip, localName, translate as t } from '@truth-platform/ui'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import draggable from 'vuedraggable'
import { useIndustries, type Industry } from '@/api/taxonomy'
import { orderIndustries, readOrder, writeOrder } from '@/lib/industries'
import IndustryDialog from '@/components/settings/IndustryDialog.vue'
import MdiIcon from '@/components/settings/MdiIcon.vue'

const { industries, loading, refresh } = useIndustries()
const arranged = ref<Industry[]>([])
const dialogOpen = ref(false)
const edited = ref<Industry | null>(null)

watch(industries, (list) => (arranged.value = orderIndustries(list as Industry[], readOrder())), { immediate: true })
onMounted(() => void refresh())

const keys = computed(() => (industries.value as Industry[]).map((i) => i.key))
function persistOrder() {
  writeOrder(arranged.value.map((i) => i.key))
}
function openCreate() {
  edited.value = null
  dialogOpen.value = true
}
function openEdit(i: Industry) {
  edited.value = i
  dialogOpen.value = true
}
</script>

<template>
  <div>
    <PageHeader :title="t('app.industries')" :description="t('settings.industriesDescription')">
      <template #actions>
        <Button variant="primary" @click="openCreate"><Plus /> {{ t('industries.new') }}</Button>
      </template>
    </PageHeader>

    <div v-if="loading && !arranged.length" class="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
      <Skeleton v-for="n in 6" :key="n" class="h-40 rounded-2xl" />
    </div>

    <EmptyState v-else-if="!arranged.length" :title="t('settings.noIndustries')" :description="t('settings.noIndustriesHint')">
      <template #icon><Building2 /></template>
      <template #action><Button variant="primary" @click="openCreate"><Plus /> {{ t('industries.new') }}</Button></template>
    </EmptyState>

    <draggable
      v-else
      v-model="arranged"
      item-key="key"
      handle=".drag-handle"
      ghost-class="opacity-40"
      class="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4"
      @end="persistOrder"
    >
      <template #item="{ element: i }">
        <RouterLink
          :to="{ path: '/events', query: { industries: i.key } }"
          class="card-surface group flex flex-col gap-3 p-5 transition-all hover:-translate-y-px hover:shadow-pop focus-visible:outline-2"
        >
          <div class="flex items-start gap-3">
            <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
              <MdiIcon :name="i.icon" :size="24" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-[15px] font-semibold" dir="auto">{{ localName(i) }}</div>
              <code class="mono text-xs text-muted-foreground" dir="ltr">{{ i.key }}</code>
            </div>
            <Tooltip :content="t('settings.dragToReorderTabs')">
              <span class="drag-handle grid size-7 cursor-grab place-items-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100" @click.prevent>
                <GripVertical class="size-4" />
              </span>
            </Tooltip>
          </div>
          <p v-if="i.description" class="line-clamp-3 text-[13px] text-muted-foreground" dir="auto"><LinkedText :text="i.description" /></p>
          <div v-if="i.modules.length" class="flex flex-wrap gap-1">
            <Badge v-for="m in i.modules" :key="m" tone="outline"><span dir="auto">{{ m }}</span></Badge>
          </div>
          <div class="mt-auto flex items-center justify-between border-t border-border pt-3">
            <span class="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <CalendarDays class="size-4" />
              <span class="tabular-nums">{{ t('settings.eventCount', { count: i.event_count }) }}</span>
            </span>
            <Button variant="ghost" size="sm" @click.prevent.stop="openEdit(i)"><Pencil /> {{ t('common.edit') }}</Button>
          </div>
        </RouterLink>
      </template>
    </draggable>

    <IndustryDialog v-model:open="dialogOpen" :industry="edited" :taken="keys" />
  </div>
</template>
