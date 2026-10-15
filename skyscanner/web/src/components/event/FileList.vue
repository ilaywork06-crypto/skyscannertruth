<script setup lang="ts">
/**
 * The files of a record: grouped by folder (folders can be folded), each opening in the viewer and downloadable.
 * Mounted inside AG Grid cells too, so its styles are plain namespaced rules.
 */
import { ChevronDown, Download, Folder } from 'lucide-vue-next'
import { EMPTY_PLACEHOLDER, HighlightedText, formatDateTime, matchesTerm, translate as t } from '@truth-platform/ui'
import { computed, ref } from 'vue'
import type { Artifact } from '@/api/artifacts'
import { fileIcon } from '@/lib/icons'

const props = withDefaults(
  defineProps<{ files: Artifact[]; startOpen?: boolean; activeId?: string | null; showUpload?: boolean; search?: string; flat?: boolean }>(),
  { startOpen: false, activeId: null, showUpload: false, search: '', flat: false },
)
const emit = defineEmits<{ open: [artifact: Artifact]; download: [artifact: Artifact] }>()

/** Folders whose state differs from the default (open when `startOpen`, folded otherwise). */
const toggled = ref<string[]>([])
const groups = computed(() => {
  if (props.flat) return props.files.length ? [{ name: '', files: props.files }] : []
  const map = new Map<string, Artifact[]>()
  for (const f of props.files) {
    const k = f.folder ?? ''
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(f)
  }
  return [...map.entries()].map(([name, files]) => ({ name, files }))
})
const isOpen = (name: string) => !name || props.startOpen !== toggled.value.includes(name)
function toggle(name: string) {
  toggled.value = toggled.value.includes(name) ? toggled.value.filter((n) => n !== name) : [...toggled.value, name]
}
</script>

<template>
  <span v-if="!files.length" class="gc-empty">{{ EMPTY_PLACEHOLDER }}</span>
  <div v-else class="sky-files">
    <template v-for="g in groups" :key="g.name">
      <button v-if="g.name" type="button" class="sky-files__folder" :aria-expanded="isOpen(g.name)" @click.stop="toggle(g.name)">
        <Folder class="sky-files__icon" />
        <span class="sky-files__name" dir="auto">{{ g.name }}</span>
        <span class="sky-files__count">{{ g.files.length }}</span>
        <ChevronDown :class="['sky-files__chevron', !isOpen(g.name) && 'sky-files__chevron--closed']" />
      </button>
      <template v-if="isOpen(g.name)">
        <div v-for="f in g.files" :key="f.id || f.path" :class="['sky-files__row', g.name && 'sky-files__row--nested', f.id === activeId && 'sky-files__row--active']">
          <button type="button" class="sky-files__open" :title="f.name" :aria-label="t('files.openNamed', { name: f.name })" @click.stop="emit('open', f)">
            <component :is="fileIcon(f.name, f.suffix, f.content_type)" class="sky-files__icon" />
            <span class="sky-files__text">
              <span class="sky-files__name" dir="auto">
                <HighlightedText v-if="matchesTerm(f.name, search)" :text="f.name" :term="search" />
                <template v-else>{{ f.name }}</template>
              </span>
              <span v-if="showUpload" class="sky-files__meta" dir="ltr">{{ formatDateTime(f.created_at) }} · {{ f.uploaded_by ?? EMPTY_PLACEHOLDER }}</span>
            </span>
          </button>
          <button type="button" class="sky-files__download" :aria-label="t('files.downloadNamed', { name: f.name })" :title="t('files.download')" @click.stop="emit('download', f)">
            <Download />
          </button>
        </div>
      </template>
    </template>
  </div>
</template>

<style>
.sky-files { display: flex; flex-direction: column; gap: 1px; min-width: 0; width: 100%; padding-block: 4px; }
.sky-files__folder, .sky-files__open {
  display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1 1 auto; border-radius: 6px; padding: 2px 6px;
  text-align: start; color: rgb(var(--foreground)); font-size: 12.5px; line-height: 1.35;
}
.sky-files__folder { color: rgb(var(--muted-foreground)); font-weight: 500; }
.sky-files__folder:hover, .sky-files__open:hover { background: rgb(var(--muted)); }
.sky-files__row { display: flex; align-items: center; gap: 2px; min-width: 0; border-radius: 6px; }
.sky-files__row--nested { padding-inline-start: 14px; }
.sky-files__row--active { background: rgb(var(--primary-soft)); }
.sky-files__icon { width: 14px; height: 14px; flex: none; color: rgb(var(--muted-foreground)); }
.sky-files__text { display: flex; flex-direction: column; min-width: 0; }
.sky-files__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; unicode-bidi: plaintext; text-align: start; }
.sky-files__meta { font-size: 11px; color: rgb(var(--muted-foreground)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: start; }
.sky-files__count { font-size: 11px; border-radius: 999px; padding: 0 6px; background: rgb(var(--subtle)); color: rgb(var(--muted-foreground)); }
.sky-files__chevron { width: 14px; height: 14px; margin-inline-start: auto; transition: transform 120ms; }
.sky-files__chevron--closed { transform: rotate(-90deg); }
[dir='rtl'] .sky-files__chevron--closed { transform: rotate(90deg); }
.sky-files__download {
  display: grid; place-items: center; flex: none; width: 24px; height: 24px; border-radius: 6px; color: rgb(var(--muted-foreground));
  opacity: 0; transition: opacity 120ms;
}
.sky-files__download svg { width: 14px; height: 14px; }
.sky-files__download:hover { background: rgb(var(--muted)); color: rgb(var(--foreground)); }
.sky-files__row:hover .sky-files__download, .sky-files__download:focus-visible, .sky-files__row--active .sky-files__download { opacity: 1; }
</style>
