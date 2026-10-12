<template>
  <!--
    The industries are a filter: any number of them can be picked, and the table shows the events of every
    picked one. Nothing picked shows every industry, which is why there is no tab for "all". The tabs can
    still be dragged into the order a person works in.
  -->
  <nav
    class="industry-tabs"
    :aria-label="t('tabs.label')"
  >
    <button
      v-for="(industry, index) in orderedIndustries"
      :key="industry.key"
      type="button"
      class="industry-tabs__tab"
      :class="{
        'industry-tabs__tab--active': modelValue.includes(industry.key),
        'industry-tabs__tab--dragged': draggedKey === industry.key,
        'industry-tabs__tab--target': dropIndex === index && draggedKey !== industry.key,
      }"
      :aria-pressed="modelValue.includes(industry.key)"
      :title="industryTitle(industry)"
      draggable="true"
      @click="toggle(industry.key)"
      @dragstart="onDragStart(industry.key, $event)"
      @dragover.prevent="dropIndex = index"
      @dragleave="onDragLeave(index)"
      @drop.prevent="onDrop(index)"
      @dragend="onDragEnd"
    >
      <v-icon
        class="industry-tabs__icon"
        :icon="iconOf(industry)"
        size="22"
      />
      <span
        class="industry-tabs__name"
        dir="auto"
      >{{ localName(industry) }}</span>
    </button>
  </nav>
</template>

<script lang="ts">
import type { Industry } from '@/models/industry'

interface Props {
  industries: Industry[]
  /** The keys of the picked industries; empty for every industry. */
  modelValue: string[]
}

interface Emits {
  (event: 'update:modelValue', industries: string[]): void
}

/** What a drag carries, which a browser insists on being handed something for. */
const DRAG_MEDIA_TYPE = 'text/plain'

/** What an industry is drawn with when it was never given an icon. */
const FALLBACK_ICON = 'mdi-domain'
</script>

<script setup lang="ts">
import { localName, useLanguage } from '@truth-platform/core-ui'
import { computed, ref } from 'vue'

import { moveIndustry, orderIndustries, readOrder, writeOrder } from '@/utils/industry-order'

const { t } = useLanguage()

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/* The arrangement this browser was left in, which the tabs are rendered in until it is changed again. */
const order = ref<string[]>(readOrder())

const draggedKey = ref<string | null>(null)
const dropIndex = ref<number | null>(null)

const orderedIndustries = computed<Industry[]>(() => orderIndustries(props.industries, order.value))

const orderedKeys = computed<string[]>(() => orderedIndustries.value.map((industry) => industry.key))

const iconOf = (industry: Industry): string => (industry.icon.length > 0 ? industry.icon : FALLBACK_ICON)

const industryTitle = (industry: Industry): string => `${localName(industry)} · ${industry.event_count}`

/**
 * Add an industry to the pick, or take it out again.
 */
const toggle = (key: string) => {
  const picked = props.modelValue.includes(key)
    ? props.modelValue.filter((candidate) => candidate !== key)
    : [...props.modelValue, key]

  /* The pick is handed over in the order the tabs stand in, so the same pick always reads the same. */
  emit(
    'update:modelValue',
    orderedKeys.value.filter((candidate) => picked.includes(candidate)),
  )
}

const onDragStart = (key: string, event: DragEvent) => {
  draggedKey.value = key
  event.dataTransfer?.setData(DRAG_MEDIA_TYPE, key)
  if (event.dataTransfer !== null) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

/*
 * Leaving one tab is only worth forgetting the marker for when the pointer has really left it, rather than
 * when it has crossed onto the next one - which fires the leave of the old tab after the over of the new.
 */
const onDragLeave = (index: number) => {
  if (dropIndex.value === index) {
    dropIndex.value = null
  }
}

const onDrop = (index: number) => {
  const key = draggedKey.value
  const from = key === null ? -1 : orderedKeys.value.indexOf(key)
  if (from >= 0) {
    order.value = moveIndustry(orderedKeys.value, from, index)
    writeOrder(order.value)
  }

  onDragEnd()
}

const onDragEnd = () => {
  draggedKey.value = null
  dropIndex.value = null
}
</script>

<style scoped>
.industry-tabs {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 0.375rem;
  padding-inline: 2rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.industry-tabs::-webkit-scrollbar {
  display: none;
}

/*
 * A folder tab standing on the lower edge of the banner, with the icon of the industry above its name. The
 * picked ones are the sheets laid over the banner; the others are outlines.
 */
.industry-tabs__tab {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1875rem;
  min-inline-size: 5.5rem;
  max-inline-size: 11rem;
  padding-inline: 1rem;
  padding-block: 0.4375rem 0.375rem;
  border: 0.0625rem solid rgba(var(--v-theme-on-surface), 0.35);
  border-block-end: none;
  border-radius: 0.5rem 0.5rem 0 0;
  background: transparent;
  color: rgb(var(--v-theme-on-surface));
  font: inherit;
  cursor: pointer;
  user-select: none;
  transition:
    background-color 0.15s ease-in-out,
    color 0.15s ease-in-out;
}

.industry-tabs__tab:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.1);
}

.industry-tabs__tab:focus-visible {
  outline: 0.125rem solid rgb(var(--v-theme-primary));
  outline-offset: -0.125rem;
}

.industry-tabs__icon {
  opacity: 0.9;
}

.industry-tabs__name {
  max-inline-size: 100%;
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.industry-tabs__tab--active {
  background-color: rgb(var(--v-theme-tab-active));
  border-color: transparent;
  color: rgb(var(--v-theme-on-tab-active));
}

.industry-tabs__tab--active .industry-tabs__name {
  font-weight: 700;
}

.industry-tabs__tab--active:hover {
  background-color: rgb(var(--v-theme-tab-active));
}

/* The tab being carried fades, and the one it would land on shows the edge it would land against. */
.industry-tabs__tab--dragged {
  opacity: 0.4;
}

.industry-tabs__tab--target {
  box-shadow: inset 0.1875rem 0 0 rgb(var(--v-theme-primary));
}

@media (max-width: 48rem) {
  .industry-tabs {
    padding-inline: 1rem;
  }
}
</style>
