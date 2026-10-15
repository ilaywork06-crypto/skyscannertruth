<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { Button, Select, translate as t } from '@truth-platform/ui'
import { computed } from 'vue'

const props = withDefaults(defineProps<{ page: number; pageSize: number; pageCount: number; total: number; sizes?: number[] }>(), { sizes: () => [10, 25, 50, 100] })
const emit = defineEmits<{ 'update:page': [n: number]; 'update:pageSize': [n: number] }>()
const summary = computed(() => {
  if (props.total === 0) return t('pagination.empty')
  return t('pagination.range', { first: (props.page - 1) * props.pageSize + 1, last: Math.min(props.page * props.pageSize, props.total), total: props.total })
})
const size = computed({ get: () => props.pageSize, set: (v: number | null | undefined) => v && emit('update:pageSize', v) })
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
    <span class="tabular-nums">{{ summary }}</span>
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <span>{{ t('pagination.perPage') }}</span>
        <Select v-model="size" size="sm" class="w-20" :options="sizes.map((s) => ({ value: s, label: String(s) }))" />
      </div>
      <div class="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" :disabled="page <= 1" :aria-label="t('pagination.previous')" @click="emit('update:page', page - 1)"><ChevronLeft class="rtl:rotate-180" /></Button>
        <span class="min-w-14 text-center tabular-nums">{{ page }} / {{ pageCount }}</span>
        <Button size="icon-sm" variant="ghost" :disabled="page >= pageCount" :aria-label="t('pagination.next')" @click="emit('update:page', page + 1)"><ChevronRight class="rtl:rotate-180" /></Button>
      </div>
    </div>
  </div>
</template>
