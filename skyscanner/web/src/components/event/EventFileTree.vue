<script setup lang="ts">
/**
 * Every file of an event as a tree (spec §6.4 "Event files"): the event's own files, then one branch per
 * entity and file role. Branches start open; a file opens in the preview beside the tree.
 */
import { ChevronDown, Download, Folder, FolderOpen } from 'lucide-vue-next'
import { EMPTY_PLACEHOLDER, formatBytes, formatDateTime, translate as t } from '@truth-platform/ui'
import { computed, ref, watch } from 'vue'
import type { Artifact } from '@/api/artifacts'
import type { EventDetail } from '@/api/events'
import { fileIcon } from '@/lib/icons'

const props = defineProps<{ event: EventDetail; typeLabel: (name: string) => string; activeId?: string | null }>()
const emit = defineEmits<{ open: [artifact: Artifact]; download: [artifact: Artifact] }>()

interface Branch {
  id: string
  title: string
  depth: number
  files: Artifact[]
}
const ROLES = [
  ['raw_files', 'entityForm.rawFiles'],
  ['parsed_files', 'entityForm.parsedFiles'],
  ['parsed_additional_files', 'entityForm.parsedAdditionalFiles'],
] as const

const branches = computed<Branch[]>(() => {
  const out: Branch[] = []
  if (props.event.additional_files.length) out.push({ id: 'additional', title: t('create.files'), depth: 0, files: props.event.additional_files })
  for (const e of props.event.objects) {
    for (const [role, label] of ROLES) {
      const files = e[role]
      if (files.length) out.push({ id: `${e.id}:${role}`, title: `${props.typeLabel(e.object_type?.name ?? '')} · ${e.name} · ${t(label)}`, depth: 1, files })
    }
  }
  return out
})
const closed = ref<string[]>([])
watch(() => props.event.objects, () => (closed.value = []))
const toggle = (id: string) => (closed.value = closed.value.includes(id) ? closed.value.filter((x) => x !== id) : [...closed.value, id])
</script>

<template>
  <p v-if="!branches.length" class="px-1 py-6 text-center text-[13px] text-muted-foreground">{{ t('event.noFiles') }}</p>
  <div v-else class="flex flex-col gap-1">
    <div v-for="b in branches" :key="b.id" :class="b.depth ? 'ms-3' : ''">
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[13px] font-medium hover:bg-muted"
        :aria-expanded="!closed.includes(b.id)"
        @click="toggle(b.id)"
      >
        <component :is="closed.includes(b.id) ? Folder : FolderOpen" class="size-4 shrink-0 text-muted-foreground" />
        <span class="min-w-0 flex-1 truncate" dir="auto" :title="b.title">{{ b.title }}</span>
        <span class="rounded-full bg-subtle px-1.5 text-[11px] leading-5 text-muted-foreground tabular-nums">{{ b.files.length }}</span>
        <ChevronDown :class="['size-4 shrink-0 text-muted-foreground transition-transform', closed.includes(b.id) && '-rotate-90 rtl:rotate-90']" />
      </button>
      <div v-if="!closed.includes(b.id)" class="ms-4 flex flex-col border-s border-border ps-2">
        <div
          v-for="f in b.files"
          :key="f.id || f.path"
          :class="['group flex items-center gap-1 rounded-lg', f.id === activeId ? 'bg-primary-soft' : 'hover:bg-muted']"
        >
          <button type="button" class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-start" :title="f.name" @click="emit('open', f)">
            <component :is="fileIcon(f.name, f.suffix, f.content_type)" class="size-4 shrink-0 text-muted-foreground" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate text-[13px]" dir="auto">{{ f.name }}</span>
              <span class="truncate text-[11px] text-muted-foreground" dir="ltr">{{ formatDateTime(f.created_at) }} · {{ f.uploaded_by ?? EMPTY_PLACEHOLDER }}</span>
            </span>
            <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">{{ formatBytes(f.size_bytes) }}</span>
          </button>
          <button
            type="button"
            class="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 hover:bg-card hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            :aria-label="t('files.downloadNamed', { name: f.name })"
            @click="emit('download', f)"
          >
            <Download class="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
