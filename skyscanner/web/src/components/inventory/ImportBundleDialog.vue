<script setup lang="ts">
/** Restore a bundle exported from this inventory or another (spec §4.18). Only what is not here yet is written. */
import { Package, Upload } from 'lucide-vue-next'
import { Button, Dialog, Progress, formatBytes, notify, reportError, translate as t } from '@truth-platform/ui'
import { computed, ref, watch } from 'vue'
import { importBundle, type ImportSummary } from '@/api/grid'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ restored: [summary: ImportSummary] }>()
const file = ref<File | null>(null)
const running = ref(false)
const summary = ref<ImportSummary | null>(null)
const input = ref<HTMLInputElement>()

watch(open, (o) => {
  if (o) {
    file.value = null
    summary.value = null
  }
})
const declared = computed(() => {
  const s = summary.value
  return s ? s.industries_created + s.types_created + s.platforms_created + s.fields_created : 0
})
function done(s: ImportSummary) {
  return t('import.done', { events: s.events_created, files: s.files_restored })
}
async function restore() {
  if (!file.value) return
  running.value = true
  notify(t('import.started'), 'info')
  try {
    const s = await importBundle(file.value)
    summary.value = s
    notify(done(s), s.failures.length ? 'warning' : 'success')
    if (s.events_created || s.files_restored) emit('restored', s)
  } catch (e) {
    reportError(e)
  } finally {
    running.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open" size="lg" :persistent="running" :title="t('import.title')" :description="t('import.note')">
    <template #icon><Package /></template>
    <div class="flex flex-col gap-4">
      <div>
        <p class="mb-1.5 text-[13px] font-medium">{{ t('import.pick') }}</p>
        <input ref="input" type="file" accept=".zip,application/zip" class="hidden" @change="file = ($event.target as HTMLInputElement).files?.[0] ?? null" />
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl border border-dashed border-input bg-card px-4 py-4 text-start hover:bg-muted/50"
          :disabled="running"
          @click="input?.click()"
        >
          <div class="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"><Package class="size-4" /></div>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium" dir="auto">{{ file?.name ?? t('files.dropzone') }}</div>
            <div v-if="file" class="text-xs text-muted-foreground">{{ t('import.size', { size: formatBytes(file.size) }) }}</div>
          </div>
        </button>
      </div>
      <div v-if="running" class="flex flex-col gap-1.5">
        <Progress :value="0" indeterminate />
        <span class="text-xs text-muted-foreground">{{ t('import.running') }}</span>
      </div>
      <div v-if="summary" class="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/40 p-4 text-[13px]">
        <p class="font-medium">{{ done(summary) }}</p>
        <p v-if="declared">{{ t('import.declarations', { industries: summary.industries_created, types: summary.types_created, platforms: summary.platforms_created, fields: summary.fields_created }) }}</p>
        <p v-if="summary.events_skipped" class="text-muted-foreground">{{ t('import.skipped', { count: summary.events_skipped }) }}</p>
        <div v-if="summary.failures.length" class="mt-1">
          <p class="font-medium text-danger">{{ t('import.failures') }}</p>
          <ul class="list-disc ps-5 text-danger"><li v-for="(f, i) in summary.failures" :key="i" dir="auto">{{ f }}</li></ul>
        </div>
      </div>
    </div>
    <template #footer>
      <Button variant="ghost" :disabled="running" @click="open = false">{{ t('import.close') }}</Button>
      <Button variant="primary" :disabled="!file || running" :loading="running" @click="restore"><Upload /> {{ t('import.restore') }}</Button>
    </template>
  </Dialog>
</template>
