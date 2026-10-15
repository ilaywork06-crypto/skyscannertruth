<script setup lang="ts">
/**
 * Pick files by click, Enter/Space or drag and drop. The same file name is taken only once per pick: a name
 * already present (or met twice in one drop) is refused and named under the zone.
 */
import { Upload, X } from 'lucide-vue-next'
import { cn, formatBytes, joinIsolated, translate as t } from '@truth-platform/ui'
import { computed, ref } from 'vue'
import { fileIcon } from '@/lib/icons'

const props = defineProps<{ label?: string; disabled?: boolean; compact?: boolean; id?: string }>()
const files = defineModel<File[]>('files', { default: () => [] })
const emit = defineEmits<{ added: [files: File[]] }>()

const input = ref<HTMLInputElement>()
const active = ref(false)
const rejected = ref<string[]>([])

const totalSize = computed(() => files.value.reduce((s, f) => s + f.size, 0))

function open() {
  if (!props.disabled) input.value?.click()
}

function append(picked: File[]) {
  if (props.disabled || picked.length === 0) return
  const names = new Set(files.value.map((f) => f.name))
  const accepted: File[] = []
  const refused: string[] = []
  for (const file of picked) {
    if (names.has(file.name)) refused.push(file.name)
    else {
      names.add(file.name)
      accepted.push(file)
    }
  }
  rejected.value = [...new Set(refused)]
  if (accepted.length) {
    files.value = [...files.value, ...accepted]
    emit('added', accepted)
  }
}

function onPick(e: Event) {
  const el = e.target as HTMLInputElement
  append([...(el.files ?? [])])
  el.value = ''
}

function onDrop(e: DragEvent) {
  active.value = false
  append([...(e.dataTransfer?.files ?? [])])
}

function remove(index: number) {
  rejected.value = []
  files.value = files.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div v-if="label" class="flex items-center justify-between gap-2">
      <span class="text-[13px] font-medium">{{ label }}</span>
      <span v-if="files.length" class="text-xs tabular-nums text-muted-foreground">{{ files.length }} · {{ formatBytes(totalSize) }}</span>
    </div>
    <div
      :id="id"
      role="button"
      :tabindex="disabled ? -1 : 0"
      :aria-disabled="disabled || undefined"
      :aria-label="label || t('files.dropzone')"
      :class="cn(
        'flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-input bg-muted/30 px-4 text-center transition-colors',
        'outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring',
        compact ? 'py-3' : 'py-5',
        active && 'border-primary bg-primary-soft/60',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-primary/60 hover:bg-muted/60',
      )"
      @click="open"
      @keydown.enter.prevent="open"
      @keydown.space.prevent="open"
      @dragover.prevent="!disabled && (active = true)"
      @dragleave.prevent="active = false"
      @drop.prevent="onDrop"
    >
      <Upload class="size-4 text-muted-foreground" />
      <span class="text-[13px] font-medium">{{ t('files.dropzone') }}</span>
      <span class="text-xs text-muted-foreground">{{ t('files.dropzoneHint') }}</span>
      <input ref="input" type="file" multiple class="hidden" @change="onPick" />
    </div>
    <p v-if="rejected.length" class="text-xs text-danger" dir="auto">{{ t('files.alreadyPicked', { names: joinIsolated(rejected) }) }}</p>
    <ul v-if="files.length" class="flex flex-wrap gap-1.5">
      <li
        v-for="(file, i) in files"
        :key="file.name"
        class="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1 text-xs shadow-soft"
      >
        <component :is="fileIcon(file.name, '', file.type)" class="size-3.5 shrink-0 text-muted-foreground" />
        <span class="max-w-[22rem] truncate" dir="auto" :title="file.name">{{ file.name }}</span>
        <span class="shrink-0 tabular-nums text-muted-foreground">{{ formatBytes(file.size) }}</span>
        <button
          v-if="!disabled"
          type="button"
          class="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          :aria-label="t('files.remove', { name: file.name })"
          @click.stop="remove(i)"
        >
          <X class="size-3" />
        </button>
      </li>
    </ul>
  </div>
</template>
