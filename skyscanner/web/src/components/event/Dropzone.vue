<script setup lang="ts">
/** Files to upload: click or drop; a name already picked is refused (and said so). */
import { UploadCloud, X } from 'lucide-vue-next'
import { cn, formatBytes, joinIsolated, translate as t } from '@truth-platform/ui'
import { ref } from 'vue'
import { fileIcon } from '@/lib/icons'

defineProps<{ label?: string }>()
const files = defineModel<File[]>('files', { default: () => [] })
const input = ref<HTMLInputElement>()
const active = ref(false)
const rejected = ref<string[]>([])

function append(list: FileList | File[] | null | undefined) {
  const picked = [...(list ?? [])]
  const taken = new Set(files.value.map((f) => f.name))
  const accepted: File[] = []
  const refused: string[] = []
  for (const f of picked) {
    if (taken.has(f.name)) refused.push(f.name)
    else {
      taken.add(f.name)
      accepted.push(f)
    }
  }
  rejected.value = [...new Set(refused)]
  if (accepted.length) files.value = [...files.value, ...accepted]
}
function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  append(el.files)
  el.value = ''
}
function onDrop(e: DragEvent) {
  active.value = false
  append(e.dataTransfer?.files)
}
function remove(name: string) {
  rejected.value = []
  files.value = files.value.filter((f) => f.name !== name)
}
function openPicker(e?: KeyboardEvent) {
  e?.preventDefault()
  input.value?.click()
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <p v-if="label" class="text-[13px] font-medium">{{ label }}</p>
    <div
      role="button"
      tabindex="0"
      :class="cn(
        'flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-card px-4 py-4 text-center transition-colors hover:bg-muted/50',
        active && 'border-primary bg-primary-soft/40',
      )"
      @click="openPicker()"
      @keydown.enter="openPicker"
      @keydown.space="openPicker"
      @dragover.prevent="active = true"
      @dragleave="active = false"
      @drop.prevent="onDrop"
    >
      <input ref="input" type="file" multiple class="hidden" @change="onPick" />
      <template v-if="!files.length">
        <UploadCloud class="size-5 text-muted-foreground" />
        <span class="text-[13px] text-muted-foreground">{{ t('files.dropzone') }}</span>
      </template>
      <div v-else class="flex w-full flex-wrap gap-1.5" @click.stop>
        <span v-for="f in files" :key="f.name" class="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs">
          <component :is="fileIcon(f.name, '', f.type)" class="size-3.5 shrink-0 text-muted-foreground" />
          <span class="max-w-[22rem] truncate" dir="auto" :title="f.name">{{ f.name }}</span>
          <span class="shrink-0 tabular-nums text-muted-foreground">{{ formatBytes(f.size) }}</span>
          <button type="button" class="text-muted-foreground hover:text-foreground" :aria-label="t('files.remove', { name: f.name })" @click.stop="remove(f.name)"><X class="size-3" /></button>
        </span>
        <button type="button" class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted" @click.stop="openPicker()"><UploadCloud class="size-3.5" />{{ t('files.dropzone') }}</button>
      </div>
    </div>
    <p v-if="rejected.length" class="text-xs text-danger" dir="auto">{{ t('files.alreadyPicked', { names: joinIsolated(rejected) }) }}</p>
    <p v-else class="text-xs text-muted-foreground">{{ t('files.dropzoneHint') }}</p>
  </div>
</template>
