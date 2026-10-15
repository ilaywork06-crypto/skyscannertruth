<script setup lang="ts">
/**
 * One stored file, shown the way its kind allows (spec §8.2): images, video and sound, PDF and HTML in a frame,
 * Word documents through docx-preview, workbooks and delimited text as a table, other text as text. Large text
 * is read a 1 MiB window at a time (HTTP ranges), keeping a delimited file's heading row across windows.
 * Anything else - or anything that fails - offers the download instead.
 */
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, FileQuestion, Table2, Text } from 'lucide-vue-next'
import { Button, Spinner, delimiterOf, formatBytes, parseDelimited, translate as t, wholeLines } from '@truth-platform/ui'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { contentUrl, type Artifact } from '@/api/artifacts'
import { suffixOf } from '@/lib/icons'
import {
  HEADING_BYTES, ROW_LIMIT, WINDOW_BYTES, isWindowed, isWorkbook, previewMode, readRange, readWorkbook, tooLarge,
} from '@/lib/preview'

const props = defineProps<{ artifact: Artifact; compact?: boolean }>()
const emit = defineEmits<{ download: [artifact: Artifact] }>()

const mode = computed(() => previewMode(props.artifact))
const url = computed(() => contentUrl(props.artifact.path, { inline: true }))
const size = computed(() => props.artifact.size_bytes ?? 0)
const windowed = computed(() => isWindowed(props.artifact, mode.value))

const loading = ref(false)
const failure = ref('')
const text = ref<string | null>(null)
const rows = shallowRef<string[][]>([])
const truncated = ref(false)
const showText = ref(false)
const offset = ref(0)
const slider = ref(0)
const heading = shallowRef<string[] | null>(null)
const docBody = ref<HTMLElement>()
const docStyle = ref<HTMLElement>()
let token = 0

const fallback = computed(() => {
  if (failure.value) return failure.value
  if (tooLarge(props.artifact, mode.value)) return t('preview.tooLarge')
  if (mode.value === 'unsupported') return t('preview.unsupported')
  return ''
})

const header = computed(() => (rows.value.length ? rows.value[0] : []))
const body = computed(() => {
  const width = header.value.length
  return rows.value.slice(1).map((r) => (r.length < width ? [...r, ...Array(width - r.length).fill('')] : r))
})
const tableNote = computed(() => {
  const count = Math.max(0, rows.value.length - 1)
  if (windowed.value) return t('preview.windowRows', { rows: count, share: size.value ? Math.round((offset.value / size.value) * 100) : 0 })
  if (truncated.value) return t('preview.firstRows', { rows: ROW_LIMIT - 1 })
  return t('preview.rows', { rows: count })
})
const lastWindowStart = computed(() => Math.max(0, size.value - WINDOW_BYTES))
const atStart = computed(() => offset.value <= 0)
const atEnd = computed(() => offset.value + WINDOW_BYTES >= size.value)

function reset() {
  failure.value = ''
  text.value = null
  rows.value = []
  truncated.value = false
  showText.value = false
  heading.value = null
  offset.value = 0
  slider.value = 0
}

async function loadWhole(current: number) {
  const a = props.artifact
  if (mode.value === 'document') {
    const res = await fetch(url.value)
    if (!res.ok) throw new Error(t('preview.readFailure'))
    const blob = await res.blob()
    if (current !== token) return
    // The document is drawn into the page itself, so its container must be on screen first.
    loading.value = false
    await nextTick()
    const { renderAsync } = await import('docx-preview')
    if (current !== token || !docBody.value) return
    docBody.value.innerHTML = ''
    await renderAsync(blob, docBody.value, docStyle.value, { className: 'docx', inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true, useBase64URL: true })
    return
  }
  if (mode.value === 'table' && isWorkbook(a)) {
    const res = await fetch(url.value)
    if (!res.ok) throw new Error(t('preview.readFailure'))
    const book = await readWorkbook(await res.arrayBuffer(), ROW_LIMIT)
    if (current !== token) return
    if (!book.rows.length) {
      failure.value = t('preview.emptyWorkbook')
      return
    }
    rows.value = book.rows
    truncated.value = book.truncated
    return
  }
  if (mode.value === 'table' || mode.value === 'text') {
    const res = await fetch(url.value)
    if (!res.ok) throw new Error(t('preview.readFailure'))
    const whole = await res.text()
    if (current !== token) return
    text.value = whole
    if (mode.value === 'table') {
      const sheet = parseDelimited(whole, delimiterOf(suffixOf(a.name, a.suffix), whole), ROW_LIMIT)
      rows.value = sheet.rows
      truncated.value = sheet.truncated
      if (!sheet.rows.length) showText.value = true
    }
  }
}

async function readHeading(current: number) {
  if (heading.value || mode.value !== 'table') return
  const end = Math.min(size.value, HEADING_BYTES) - 1
  const first = await readRange(url.value, 0, end)
  if (current !== token) return
  const line = first.split(/\r\n|\n|\r/)[0] ?? ''
  const a = props.artifact
  heading.value = parseDelimited(line, delimiterOf(suffixOf(a.name, a.suffix), line), 1).rows[0] ?? []
}

async function loadWindow(start: number) {
  const current = ++token
  loading.value = true
  failure.value = ''
  try {
    const from = Math.max(0, Math.min(start, lastWindowStart.value))
    await readHeading(current)
    const end = Math.min(size.value, from + WINDOW_BYTES) - 1
    const raw = await readRange(url.value, from, end)
    if (current !== token) return
    const lines = wholeLines(raw, from === 0, end >= size.value - 1)
    offset.value = from
    slider.value = from
    text.value = lines.text
    if (mode.value === 'table') {
      const a = props.artifact
      const delimiter = delimiterOf(suffixOf(a.name, a.suffix), heading.value?.join(',') ?? lines.text)
      const sheet = parseDelimited(lines.text, delimiter, ROW_LIMIT)
      // Away from the start every row is data: the heading is the one read off the top of the file.
      const data = from === 0 ? sheet.rows.slice(1) : sheet.rows
      rows.value = [heading.value ?? sheet.rows[0] ?? [], ...data]
      truncated.value = false
    }
  } catch {
    if (current !== token) return
    failure.value = t('preview.readFailure')
  } finally {
    if (current === token) loading.value = false
  }
}

async function load() {
  const current = ++token
  reset()
  if (fallback.value || ['image', 'video', 'audio', 'frame'].includes(mode.value)) {
    loading.value = false
    return
  }
  if (windowed.value) return loadWindow(0)
  loading.value = true
  try {
    await loadWhole(current)
  } catch {
    if (current === token) failure.value = t('preview.readFailure')
  } finally {
    if (current === token) loading.value = false
  }
}

watch(() => props.artifact.path, load, { immediate: true })
onBeforeUnmount(() => token++)

const imageFailed = ref(false)
watch(() => props.artifact.path, () => (imageFailed.value = false))
</script>

<template>
  <div class="flex min-h-0 flex-col gap-3">
    <div v-if="loading" class="grid min-h-48 place-items-center"><Spinner class="size-6" /></div>

    <div v-else-if="fallback || imageFailed" class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <div class="grid size-12 place-items-center rounded-2xl border border-border bg-card text-muted-foreground shadow-soft"><FileQuestion class="size-5" /></div>
      <p class="max-w-sm text-sm text-muted-foreground">{{ imageFailed ? t('preview.readFailure') : fallback }}</p>
      <Button size="sm" variant="secondary" @click="emit('download', artifact)"><Download /> {{ t('files.download') }}</Button>
    </div>

    <template v-else>
      <div v-if="mode === 'image'" class="grid place-items-center rounded-xl border border-border bg-muted/40 p-3">
        <img :src="url" :alt="artifact.name" class="max-h-[70vh] max-w-full rounded-lg object-contain" @error="imageFailed = true" />
      </div>
      <video v-else-if="mode === 'video'" :src="url" controls preload="metadata" class="max-h-[70vh] w-full rounded-xl border border-border bg-black" />
      <div v-else-if="mode === 'audio'" class="rounded-xl border border-border bg-muted/40 p-4"><audio :src="url" controls preload="metadata" class="w-full" /></div>
      <iframe
        v-else-if="mode === 'frame'"
        :src="url"
        :title="artifact.name"
        :class="['w-full rounded-xl border border-border bg-white', compact ? 'h-[60vh]' : 'h-[70vh]']"
      />
      <div v-else-if="mode === 'document'" class="sky-docx max-h-[70vh] overflow-auto rounded-xl border border-border bg-muted/40">
        <div ref="docStyle" />
        <div ref="docBody" dir="ltr" />
      </div>

      <template v-else-if="mode === 'table' || mode === 'text'">
        <div v-if="mode === 'table' && rows.length" class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span class="tabular-nums">{{ tableNote }}</span>
          <Button v-if="text !== null" size="xs" variant="ghost" @click="showText = !showText">
            <component :is="showText ? Table2 : Text" /> {{ showText ? t('preview.showTable') : t('preview.showText') }}
          </Button>
        </div>
        <div v-if="mode === 'table' && rows.length && !showText" class="max-h-[60vh] overflow-auto rounded-xl border border-border">
          <table class="min-w-full border-collapse text-[13px]">
            <thead class="sticky top-0 bg-muted">
              <tr>
                <th v-for="(h, i) in header" :key="i" :title="h" class="whitespace-nowrap border-b border-border px-3 py-2 text-start font-medium text-muted-foreground" dir="auto">{{ h }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in body" :key="ri" class="odd:bg-card even:bg-muted/30">
                <td v-for="(c, ci) in r" :key="ci" :title="c" class="max-w-[24rem] truncate border-b border-border/60 px-3 py-1.5" dir="auto">{{ c }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <pre
          v-else
          dir="auto"
          class="mono max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/40 p-4 text-[12.5px] leading-relaxed [overflow-wrap:anywhere]"
        >{{ text ?? '' }}</pre>

        <div v-if="windowed" class="flex flex-wrap items-center gap-2" dir="ltr">
          <Button size="icon-sm" variant="ghost" :disabled="atStart" :aria-label="t('preview.toStart')" :title="t('preview.toStart')" @click="loadWindow(0)"><ChevronsLeft /></Button>
          <Button size="icon-sm" variant="ghost" :disabled="atStart" :aria-label="t('preview.back')" :title="t('preview.back')" @click="loadWindow(offset - WINDOW_BYTES)"><ChevronLeft /></Button>
          <input
            v-model.number="slider"
            type="range"
            min="0"
            :max="lastWindowStart"
            step="1"
            class="min-w-32 flex-1 accent-[rgb(var(--primary))]"
            :aria-label="t('preview.where')"
            @change="loadWindow(slider)"
          />
          <span class="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{{ formatBytes(offset) }} / {{ formatBytes(size) }}</span>
          <Button size="icon-sm" variant="ghost" :disabled="atEnd" :aria-label="t('preview.on')" :title="t('preview.on')" @click="loadWindow(offset + WINDOW_BYTES)"><ChevronRight /></Button>
          <Button size="icon-sm" variant="ghost" :disabled="atEnd" :aria-label="t('preview.toEnd')" :title="t('preview.toEnd')" @click="loadWindow(lastWindowStart)"><ChevronsRight /></Button>
        </div>
      </template>
    </template>
  </div>
</template>

<style>
.sky-docx .docx-wrapper { background: transparent; padding: 16px; }
.sky-docx .docx-wrapper > section.docx { box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); margin-bottom: 16px; }
</style>
