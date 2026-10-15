<script setup lang="ts">
/**
 * Add files to an existing event. Files go to the storage service (form batches; files from 64 MiB on as
 * browser-driven multipart uploads), with per-file and overall progress, pause / resume and cancel. An upload
 * interrupted by a reload or a closed tab is remembered in this browser (`skyscanner.uploads.open`, 24 h):
 * the dialog lists it, and picking the same file again continues from the parts the bucket already holds.
 * Once every file is stored the event is saved with them appended (the edit needs a reason, like every edit).
 */
import { CheckCircle2, CloudUpload, History, Pause, Play, RotateCcw, Trash2, X } from 'lucide-vue-next'
import {
  Badge, Button, Dialog, Field, Input, Progress, Skeleton, formatBytes, formatDateTime, joinIsolated, notify,
  reportError, translate as t, useConfirm, type BadgeTone,
} from '@truth-platform/ui'
import { computed, ref, watch } from 'vue'
import { attachEventFiles, readEventFiles, type CreatedEvent } from '@/api/create'
import { collidingNames, deleteArtifact, discardRefusedUploads, type Artifact, type UploadTarget } from '@/api/storage'
import {
  DRIVEN_UPLOAD_BYTES, UploadCancelledError, discardOpenUpload, fingerprintOf, openUploadsFor, readFingerprint, uploadArtifacts,
  type OpenUpload,
} from '@/api/uploads'
import { useUploadControl } from '@/composables/useUploads'
import { fileIcon } from '@/lib/icons'
import Dropzone from '@/components/create/Dropzone.vue'

const props = defineProps<{ eventId: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ done: [] }>()
const confirm = useConfirm()
const control = useUploadControl()

type Phase = 'pick' | 'uploading' | 'attaching'
type RowStatus = 'queued' | 'uploading' | 'done' | 'failed'
interface Row {
  written: number
  status: RowStatus
  resumable: boolean
  resumed: number
}

const event = ref<CreatedEvent | null>(null)
const loading = ref(false)
const files = ref<File[]>([])
const reason = ref('')
const phase = ref<Phase>('pick')
const rows = ref<Row[]>([])
const interrupted = ref<OpenUpload[]>([])
const stored = ref<Artifact[]>([])
const failure = ref<string | null>(null)

const target = computed<UploadTarget>(() => ({
  ownerKind: 'events',
  ownerId: props.eventId,
  kind: 'additional',
  folder: null,
  descriptor: 'Files added after the event was created',
}))

const total = computed(() => files.value.reduce((s, f) => s + f.size, 0))
const written = computed(() => rows.value.reduce((s, r) => s + r.written, 0))
const percent = computed(() => (total.value ? Math.min(100, (written.value / total.value) * 100) : 0))
const clashing = computed(() => collidingNames(event.value?.additional_files ?? [], files.value, null))
const busy = computed(() => phase.value !== 'pick')
const canStart = computed(() => !!event.value && files.value.length > 0 && reason.value.trim().length > 0 && clashing.value.length === 0)

function refreshInterrupted() {
  interrupted.value = openUploadsFor(target.value).filter((u) => readFingerprint(u.fingerprint).folder === null)
}

async function load() {
  loading.value = true
  try {
    event.value = await readEventFiles(props.eventId)
  } catch (error) {
    reportError(error)
  } finally {
    loading.value = false
  }
}

function reset() {
  files.value = []
  reason.value = ''
  phase.value = 'pick'
  rows.value = []
  stored.value = []
  failure.value = null
  control.finish()
}

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    reset()
    refreshInterrupted()
    void load()
  },
  { immediate: true },
)

/* A picked file that matches an interrupted upload will continue it. */
watch(files, (picked) => {
  if (phase.value !== 'pick') return
  const remembered = new Set(interrupted.value.map((u) => u.fingerprint))
  rows.value = picked.map((f) => ({
    written: 0,
    status: 'queued',
    resumable: f.size >= DRIVEN_UPLOAD_BYTES && remembered.has(fingerprintOf(f, target.value)),
    resumed: 0,
  }))
})

function setRow(i: number, patch: Partial<Row>) {
  rows.value = rows.value.map((r, j) => (j === i ? { ...r, ...patch } : r))
}

async function start() {
  if (!canStart.value) return
  const run = control.start()
  phase.value = 'uploading'
  failure.value = null
  stored.value = []
  rows.value = rows.value.map((r) => ({ ...r, status: 'queued', written: 0 }))
  let uploaded: Artifact[] = []
  try {
    uploaded = await uploadArtifacts(files.value, {
      ...target.value,
      control: run,
      onFileProgress: (i, bytes) => setRow(i, { written: bytes, status: 'uploading' }),
      onFileDone: (i, artifact) => {
        setRow(i, { status: 'done', written: files.value[i]?.size ?? 0 })
        stored.value = [...stored.value, artifact]
      },
      onFileResumed: (i, bytes) => setRow(i, { resumed: bytes }),
    })
  } catch (error) {
    control.finish()
    refreshInterrupted()
    if (error instanceof UploadCancelledError) return
    rows.value = rows.value.map((r) => (r.status === 'done' ? r : { ...r, status: 'failed' }))
    failure.value = error instanceof Error ? error.message : t('errors.generic')
    // Finished files of a failed pick are pointed at by nothing: take them back. Large ones stay resumable.
    void Promise.allSettled(stored.value.map((a) => deleteArtifact(a.path)))
    stored.value = []
    phase.value = 'pick'
    reportError(error)
    return
  }

  phase.value = 'attaching'
  try {
    // Re-read the event right before saving, so files attached meanwhile by somebody else are kept.
    const current = await readEventFiles(props.eventId)
    await attachEventFiles(props.eventId, reason.value.trim(), [...current.additional_files, ...uploaded])
    notify(t('uploads.attached', { count: uploaded.length }), 'success')
    control.finish()
    emit('done')
    open.value = false
  } catch (error) {
    discardRefusedUploads(error, uploaded)
    reportError(error)
    control.finish()
    phase.value = 'pick'
  }
}

async function cancelUpload() {
  const ok = await confirm({
    title: t('uploads.cancelTitle'),
    description: t('uploads.cancelBody'),
    confirmLabel: t('uploads.cancel'),
    cancelLabel: t('uploads.keepUploading'),
    danger: true,
  })
  if (!ok) return
  control.cancel()
  void Promise.allSettled(stored.value.map((a) => deleteArtifact(a.path)))
  stored.value = []
  rows.value = rows.value.map((r) => ({ ...r, status: 'queued', written: 0 }))
  phase.value = 'pick'
  notify(t('uploads.cancelled'), 'info')
}

async function attemptClose() {
  if (phase.value === 'attaching') return
  if (phase.value === 'uploading') {
    const leave = await confirm({
      title: t('uploads.leaveTitle'),
      description: t('uploads.leaveBody'),
      confirmLabel: t('uploads.leave'),
      cancelLabel: t('uploads.keepUploading'),
    })
    if (!leave) return
    // Paused, not given up: large files stay open in the bucket and resume when picked again.
    control.cancel(true)
    void Promise.allSettled(stored.value.map((a) => deleteArtifact(a.path)))
    open.value = false
    return
  }
  if (files.value.length || reason.value.trim()) {
    const discard = await confirm({
      title: t('common.unsavedTitle'),
      description: t('common.unsavedBody'),
      confirmLabel: t('common.discard'),
      cancelLabel: t('common.keepEditing'),
      danger: true,
    })
    if (!discard) return
  }
  open.value = false
}

async function forget(upload: OpenUpload) {
  await discardOpenUpload(upload)
  refreshInterrupted()
  rows.value = rows.value.map((r, i) => (files.value[i] && fingerprintOf(files.value[i], target.value) === upload.fingerprint ? { ...r, resumable: false } : r))
}

const statusTone: Record<RowStatus, BadgeTone> = { queued: 'neutral', uploading: 'primary', done: 'success', failed: 'danger' }
const statusLabel = (r: Row) => (r.status === 'queued' && r.resumable ? t('uploads.willResume') : t(`uploads.status.${r.status}`))
</script>

<template>
  <Dialog v-model:open="open" size="lg" persistent :title="t('uploads.title')" :description="event ? t('uploads.description', { name: event.name }) : undefined" @attempt-close="attemptClose">
    <template #icon><CloudUpload /></template>

    <div v-if="loading" class="flex flex-col gap-3">
      <Skeleton class="h-24 w-full" />
      <Skeleton class="h-9 w-full" />
    </div>

    <div v-else class="flex flex-col gap-4">
      <!-- Uploads interrupted earlier (another visit, a reload) -->
      <div v-if="interrupted.length && phase === 'pick'" class="rounded-xl border border-info/30 bg-info-soft/60 p-3">
        <div class="mb-1 flex items-center gap-2 text-[13px] font-medium text-info"><History class="size-4" /> {{ t('uploads.interruptedTitle') }}</div>
        <p class="mb-2 text-xs text-muted-foreground">{{ t('uploads.interruptedHint') }}</p>
        <ul class="flex flex-col gap-1">
          <li v-for="u in interrupted" :key="u.fingerprint" class="flex items-center gap-2 text-sm">
            <component :is="fileIcon(readFingerprint(u.fingerprint).name)" class="size-4 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate" dir="auto" :title="readFingerprint(u.fingerprint).name">{{ readFingerprint(u.fingerprint).name }}</span>
            <span class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ formatBytes(readFingerprint(u.fingerprint).size) }} · {{ formatDateTime(u.openedAt) }}</span>
            <Button variant="ghost" size="icon-xs" :aria-label="t('uploads.discardInterrupted')" :title="t('uploads.discardInterrupted')" @click="forget(u)"><Trash2 /></Button>
          </li>
        </ul>
      </div>

      <Dropzone v-if="phase === 'pick'" v-model:files="files" :label="t('edit.addFiles')" />
      <p v-if="clashing.length" class="text-xs text-danger" dir="auto">{{ t('uploads.alreadyAttached', { names: joinIsolated(clashing) }) }}</p>

      <!-- Per-file progress -->
      <ul v-if="phase !== 'pick' || rows.some((r) => r.status === 'failed')" class="flex flex-col divide-y divide-border rounded-xl border border-border">
        <li v-for="(file, i) in files" :key="file.name" class="flex flex-col gap-1.5 px-3 py-2.5">
          <div class="flex items-center gap-2 text-sm">
            <component :is="fileIcon(file.name, '', file.type)" class="size-4 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate" dir="auto" :title="file.name">{{ file.name }}</span>
            <span class="shrink-0 text-xs tabular-nums text-muted-foreground">{{ formatBytes(rows[i]?.written ?? 0) }} / {{ formatBytes(file.size) }}</span>
            <Badge :tone="statusTone[rows[i]?.status ?? 'queued']">
              <CheckCircle2 v-if="rows[i]?.status === 'done'" />
              {{ rows[i] ? statusLabel(rows[i]) : '' }}
            </Badge>
          </div>
          <Progress
            :value="rows[i]?.written ?? 0"
            :max="file.size || 1"
            :tone="rows[i]?.status === 'failed' ? 'danger' : rows[i]?.status === 'done' ? 'success' : 'primary'"
          />
          <span v-if="rows[i]?.resumed" class="text-[11px] text-info">{{ t('uploads.resumedFrom', { size: formatBytes(rows[i].resumed) }) }}</span>
        </li>
      </ul>

      <!-- Overall -->
      <div v-if="phase !== 'pick'" class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span>{{ phase === 'attaching' ? t('uploads.attaching') : control.paused.value ? t('uploads.paused') : t('uploads.uploading') }}</span>
          <span class="tabular-nums">{{ t('uploads.progress', { written: formatBytes(written), total: formatBytes(total) }) }} · {{ Math.round(percent) }}%</span>
        </div>
        <Progress :value="percent" :indeterminate="phase === 'attaching'" />
      </div>

      <p v-if="failure && phase === 'pick'" class="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger" dir="auto">{{ failure }}</p>

      <Field :label="t('edit.reason')" required for="upload-reason" :error="files.length && !reason.trim() ? t('edit.reasonMissing') : null">
        <Input id="upload-reason" v-model="reason" dir="auto" :disabled="busy" :placeholder="t('uploads.reasonPlaceholder')" />
      </Field>
    </div>

    <template #footer>
      <template v-if="phase === 'uploading'">
        <Button variant="danger-soft" class="me-auto" @click="cancelUpload"><X /> {{ t('uploads.cancel') }}</Button>
        <Button v-if="control.paused.value" variant="primary" @click="control.resume()"><Play /> {{ t('uploads.resume') }}</Button>
        <Button v-else variant="secondary" @click="control.pause()"><Pause /> {{ t('uploads.pause') }}</Button>
      </template>
      <template v-else>
        <Button variant="ghost" :disabled="phase === 'attaching'" @click="attemptClose">{{ t('common.cancel') }}</Button>
        <Button variant="primary" :disabled="!canStart" :loading="phase === 'attaching'" @click="start">
          <RotateCcw v-if="failure" /><CloudUpload v-else />
          {{ failure ? t('uploads.retry') : t('uploads.start') }}
        </Button>
      </template>
    </template>
  </Dialog>
</template>
