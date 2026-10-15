<script setup lang="ts">
/**
 * The files a record already holds, each kept or marked to be detached. Detaching only drops the reference -
 * the bytes stay in storage and the change is recorded in the edit history.
 */
import { AlertTriangle, Undo2, X } from 'lucide-vue-next'
import { Button, formatBytes, translate as t } from '@truth-platform/ui'
import { computed } from 'vue'
import type { Artifact } from '@/api/artifacts'
import { fileIcon } from '@/lib/icons'

const props = defineProps<{ stored: Artifact[]; label: string }>()
const kept = defineModel<Artifact[]>('kept', { default: () => [] })
const keptIds = computed(() => new Set(kept.value.map((a) => a.id)))
const removed = computed(() => props.stored.length - kept.value.length)

function toggle(a: Artifact) {
  kept.value = keptIds.value.has(a.id) ? kept.value.filter((k) => k.id !== a.id) : props.stored.filter((s) => s.id === a.id || keptIds.value.has(s.id))
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <span class="text-[13px] font-medium">{{ label }}</span>
      <span class="text-xs tabular-nums text-muted-foreground">{{ t('files.keptOf', { kept: kept.length, stored: stored.length }) }}</span>
    </div>
    <p v-if="!stored.length" class="text-[13px] text-muted-foreground">{{ t('files.noneAttached') }}</p>
    <div v-else class="flex flex-col divide-y divide-border rounded-xl border border-border">
      <div v-for="a in stored" :key="a.id" :class="['flex items-center gap-2 px-3 py-1.5 text-[13px]', !keptIds.has(a.id) && 'bg-danger-soft/40']">
        <component :is="fileIcon(a.name, a.suffix, a.content_type)" class="size-4 shrink-0 text-muted-foreground" />
        <span :class="['min-w-0 flex-1 truncate', !keptIds.has(a.id) && 'text-muted-foreground line-through']" dir="auto" :title="a.name">{{ a.name }}</span>
        <span class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ formatBytes(a.size_bytes) }}</span>
        <Button
          size="xs"
          :variant="keptIds.has(a.id) ? 'ghost' : 'secondary'"
          :aria-label="keptIds.has(a.id) ? t('files.remove', { name: a.name }) : t('files.keep', { name: a.name })"
          @click="toggle(a)"
        >
          <template v-if="keptIds.has(a.id)"><X /> {{ t('files.detach') }}</template>
          <template v-else><Undo2 /> {{ t('files.undo') }}</template>
        </Button>
      </div>
    </div>
    <p v-if="removed > 0" class="flex items-start gap-1.5 text-xs text-warning-foreground"><AlertTriangle class="mt-px size-3.5 shrink-0" />{{ t('files.detachWarning', { count: removed }) }}</p>
  </div>
</template>
