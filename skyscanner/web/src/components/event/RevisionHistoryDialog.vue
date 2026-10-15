<script setup lang="ts">
/** Every saved edit of an event (and of its entities), newest first: who, when, why, and each value before → after. */
import { ArrowRight, History } from 'lucide-vue-next'
import { Badge, Dialog, EMPTY_PLACEHOLDER, EmptyState, LinkedText, Skeleton, formatDateTime, reportError, translate as t } from '@truth-platform/ui'
import { ref, watch } from 'vue'
import { listEntityRevisions, listEventRevisions, type Revision } from '@/api/events'
import type { JsonValue } from '@/api/taxonomy'

const props = withDefaults(defineProps<{ eventId: string; entityId?: string | null; title?: string }>(), { entityId: null, title: '' })
const open = defineModel<boolean>('open', { default: false })
const revisions = ref<Revision[]>([])
const loading = ref(false)

watch(open, async (o) => {
  if (!o) return
  loading.value = true
  revisions.value = []
  try {
    revisions.value = props.entityId ? await listEntityRevisions(props.eventId, props.entityId) : await listEventRevisions(props.eventId, true)
  } catch (e) {
    reportError(e)
  } finally {
    loading.value = false
  }
})

function show(v: JsonValue): string {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return EMPTY_PLACEHOLDER
  if (Array.isArray(v)) return v.map((x) => (x !== null && typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
</script>

<template>
  <Dialog v-model:open="open" size="xl" :title="title || t('event.history')">
    <template #icon><History /></template>
    <div v-if="loading" class="flex flex-col gap-3"><Skeleton v-for="i in 3" :key="i" class="h-20" /></div>
    <EmptyState v-else-if="!revisions.length" compact :title="t('history.empty')">
      <template #icon><History /></template>
    </EmptyState>
    <ol v-else class="flex flex-col gap-3">
      <li v-for="r in revisions" :key="r.id" class="rounded-xl border border-border bg-card p-4">
        <div class="flex flex-wrap items-center gap-2">
          <Badge tone="primary">v{{ r.version }}</Badge>
          <span class="text-[13px] font-medium" dir="auto">{{ r.target === 'entity' ? r.entity_name : t('event.badge') }}</span>
          <span class="ms-auto text-xs text-muted-foreground"><span dir="auto">{{ r.changed_by }}</span> · <span dir="ltr">{{ formatDateTime(r.changed_at) }}</span></span>
        </div>
        <p v-if="r.reason" class="mt-2 whitespace-pre-line text-[13px]" dir="auto"><LinkedText :text="r.reason" /></p>
        <div v-if="r.changes.length" class="mt-3 flex flex-col divide-y divide-border rounded-lg border border-border">
          <div v-for="c in r.changes" :key="c.key" class="grid grid-cols-1 gap-1 px-3 py-2 text-[13px] sm:grid-cols-[10rem_1fr]">
            <span class="font-medium text-muted-foreground" dir="auto">{{ c.label || c.key }}</span>
            <span class="flex min-w-0 flex-wrap items-center gap-2">
              <span class="min-w-0 break-words text-muted-foreground line-through decoration-muted-foreground/40" dir="auto"><LinkedText :text="show(c.before)" /></span>
              <ArrowRight class="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
              <span class="min-w-0 break-words" dir="auto"><LinkedText :text="show(c.after)" /></span>
            </span>
          </div>
        </div>
      </li>
    </ol>
  </Dialog>
</template>
