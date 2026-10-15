<script setup lang="ts">
/**
 * One toggle per industry - a multi-pick filter, not navigation (none picked = every industry). Tabs can be
 * dragged into the order this browser keeps (`skyscanner.industry-tabs.order`).
 */
import { cn, localName, translate as t } from '@truth-platform/ui'
import { computed, ref } from 'vue'
import type { Industry } from '@/api/taxonomy'
import { iconFor } from '@/lib/icons'
import { moveIndustry, orderIndustries, readOrder, writeOrder } from '@/lib/industries'

const props = defineProps<{ industries: Industry[]; picked: string[] }>()
const emit = defineEmits<{ change: [keys: string[]] }>()

const order = ref(readOrder())
const ordered = computed(() => orderIndustries(props.industries, order.value))
const dragged = ref<number | null>(null)
const target = ref<number | null>(null)

function toggle(key: string) {
  const set = new Set(props.picked)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  emit('change', ordered.value.map((i) => i.key).filter((k) => set.has(k)))
}
function onDragStart(e: DragEvent, i: number) {
  dragged.value = i
  e.dataTransfer?.setData('text/plain', ordered.value[i].key)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDrop(i: number) {
  if (dragged.value !== null) {
    order.value = moveIndustry(ordered.value.map((x) => x.key), dragged.value, i)
    writeOrder(order.value)
  }
  dragged.value = null
  target.value = null
}
</script>

<template>
  <nav :aria-label="t('tabs.label')" class="flex flex-wrap items-center gap-1.5">
    <button
      v-for="(ind, i) in ordered"
      :key="ind.key"
      type="button"
      draggable="true"
      :aria-pressed="picked.includes(ind.key)"
      :title="`${localName(ind)} · ${ind.event_count}`"
      :class="cn(
        'inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-all select-none',
        picked.includes(ind.key)
          ? 'border-primary/30 bg-primary text-primary-foreground shadow-soft'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
        dragged === i && 'opacity-50',
        target === i && dragged !== i && 'ring-2 ring-primary/50',
      )"
      @click="toggle(ind.key)"
      @dragstart="onDragStart($event, i)"
      @dragover.prevent="target = i"
      @dragleave="target = target === i ? null : target"
      @drop.prevent="onDrop(i)"
      @dragend="dragged = null; target = null"
    >
      <component :is="iconFor(ind.icon)" class="size-4" />
      <span dir="auto">{{ localName(ind) }}</span>
      <span :class="cn('rounded-full px-1.5 text-[11px] leading-5 tabular-nums', picked.includes(ind.key) ? 'bg-white/20' : 'bg-subtle')">{{ ind.event_count }}</span>
    </button>
  </nav>
</template>
