<script setup lang="ts">
/**
 * Edit an event (spec §6.6): the brief, platforms, the built-in fields its types ask for, its declared fields,
 * the attached files (kept or detached) and new ones. Every edit needs a reason; nothing-changed blocks saving.
 * New files are uploaded first; a refused save takes them back out of storage.
 */
import { Pencil } from 'lucide-vue-next'
import {
  Button, Combobox, Dialog, Field, Input, Progress, Select, Textarea, cn, fieldClass, localName, notify, reportError, toDateInput, toIsoDate,
  translate as t, useDirtyGuard, valueLabel,
} from '@truth-platform/ui'
import { computed, ref, watch } from 'vue'
import { discardIfRefused, uploadArtifacts, type Artifact } from '@/api/artifacts'
import {
  BRIEF_MAX_LENGTH, EXPERIMENT_RESULTS, metadataTypes, metadataValues, toMetadataAttributes, updateEvent, type EventDetail, type EventUpdateRequest,
  type ExperimentResult,
} from '@/api/events'
import { listEventTypes, listFields, listPlatforms, servesIndustry, type EventType, type FieldDefinition, type FieldType, type JsonValue, type Platform } from '@/api/taxonomy'
import { useUploadProgress } from '@/composables/useUploads'
import { askedBuiltIns, askedFieldKeys, collisionMessage } from '@/lib/events'
import Dropzone from '@/components/create/Dropzone.vue'
import MetadataFieldsPanel from '@/components/create/MetadataFieldsPanel.vue'
import StoredFilesEditor from './StoredFilesEditor.vue'

const props = defineProps<{ event: EventDetail | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [event: EventDetail] }>()

const brief = ref('')
const platforms = ref<string[]>([])
const result = ref<ExperimentResult | null>(null)
const date = ref('')
const notes = ref('')
const values = ref<Record<string, JsonValue>>({})
const types = ref<Record<string, FieldType>>({})
const kept = ref<Artifact[]>([])
const picked = ref<File[]>([])
const reason = ref('')
const saving = ref(false)
const tried = ref(false)
const allPlatforms = ref<Platform[]>([])
const eventTypes = ref<EventType[]>([])
const fields = ref<FieldDefinition[]>([])
const initialDate = ref('')
let snapshot = ''
const progress = useUploadProgress()

const ownTypes = computed(() => {
  const names = new Set((props.event?.event_type ?? []).map((x) => x.name))
  return eventTypes.value.filter((x) => names.has(x.name))
})
const builtIns = computed(() => askedBuiltIns(ownTypes.value))
const shownFields = computed(() => {
  const asked = askedFieldKeys(ownTypes.value)
  return fields.value.filter((f) => asked.has(f.key) || (values.value[f.key] !== undefined && values.value[f.key] !== null && values.value[f.key] !== ''))
})
const declaredKeys = computed(() => new Set(fields.value.map((f) => f.key)))
const hasUndeclared = computed(() => Object.keys(values.value).some((k) => !declaredKeys.value.has(k)))

const platformOptions = computed(() =>
  allPlatforms.value
    .filter((p) => servesIndustry(p, props.event?.industry) || platforms.value.includes(p.key))
    .map((p) => ({ value: p.key, label: localName(p) })),
)
const resultOptions = computed(() => EXPERIMENT_RESULTS.map((r) => ({ value: r, label: valueLabel(r) })))

function state() {
  return JSON.stringify({
    brief: brief.value, platforms: platforms.value, result: result.value, date: date.value, notes: notes.value, values: values.value,
    kept: kept.value.map((a) => a.id), picked: picked.value.map((f) => `${f.name}:${f.size}`),
  })
}

async function fill() {
  const e = props.event
  if (!e) return
  brief.value = e.name ?? ''
  platforms.value = [...e.platforms]
  result.value = e.experiment_result
  date.value = toDateInput(e.event_date)
  initialDate.value = date.value
  notes.value = e.notes ?? ''
  values.value = metadataValues(e.metadata)
  types.value = metadataTypes(e.metadata)
  kept.value = [...e.additional_files]
  picked.value = []
  reason.value = ''
  tried.value = false
  progress.reset()
  snapshot = state()
  try {
    const [p, ty, f] = await Promise.all([
      listPlatforms(e.industry),
      listEventTypes(e.industry),
      listFields({ scope: 'event', industry: e.industry, include_shared: true }),
    ])
    allPlatforms.value = p
    eventTypes.value = ty
    fields.value = f
  } catch (err) {
    reportError(err)
  }
}
watch(open, (o) => o && fill(), { immediate: true })

const dirty = computed(() => state() !== snapshot)
const briefValid = computed(() => brief.value.trim().length >= 1 && brief.value.trim().length <= BRIEF_MAX_LENGTH)
const briefChanged = computed(() => brief.value !== (props.event?.name ?? ''))
const duplicates = computed(() => collisionMessage(kept.value, picked.value, null, t('edit.thisEvent')))
const blocked = computed(() => {
  if (duplicates.value) return t('edit.duplicateFiles')
  if (briefChanged.value && !briefValid.value) return t('edit.briefInvalid')
  if (!dirty.value) return t('edit.nothingChanged')
  if (!reason.value.trim()) return t('edit.reasonMissing')
  return ''
})

const guard = useDirtyGuard({ isDirty: () => dirty.value || !!reason.value.trim(), close: () => (open.value = false) })

async function save() {
  const e = props.event
  tried.value = true
  if (!e || blocked.value) return
  saving.value = true
  let uploaded: Artifact[] = []
  try {
    uploaded = await uploadArtifacts(picked.value, {
      ownerKind: 'events', ownerId: e.id, kind: 'additional', folder: null, descriptor: 'Files added after the event was created', onProgress: progress.track(),
    })
    const body: EventUpdateRequest = {
      reason: reason.value.trim(),
      platforms: platforms.value,
      experiment_result: result.value,
      notes: notes.value,
      additional_files: [...kept.value, ...uploaded],
      metadata: toMetadataAttributes(values.value, types.value),
    }
    if (briefChanged.value) body.name = brief.value.trim()
    if (date.value !== initialDate.value) body.event_date = toIsoDate(date.value)
    const saved = await updateEvent(e.id, body)
    notify(t('edit.saved'))
    emit('saved', saved)
    open.value = false
  } catch (err) {
    discardIfRefused(err, uploaded)
    reportError(err)
  } finally {
    saving.value = false
    progress.reset()
  }
}
</script>

<template>
  <Dialog v-model:open="open" size="xl" persistent :title="t('edit.title')" @attempt-close="guard.attemptClose">
    <template #icon><Pencil /></template>
    <div class="flex flex-col gap-5">
      <Field :label="t('create.brief')" required for="edit-brief" :error="briefChanged && !briefValid ? t('edit.briefInvalid') : null">
        <Input id="edit-brief" v-model="brief" :maxlength="BRIEF_MAX_LENGTH" dir="auto" :invalid="briefChanged && !briefValid" />
        <template #hint><span class="tabular-nums">{{ brief.length }} / {{ BRIEF_MAX_LENGTH }}</span></template>
      </Field>
      <div class="grid gap-4 sm:grid-cols-2">
        <Field :label="t('create.platform')" for="edit-platforms">
          <Combobox id="edit-platforms" v-model="platforms" :options="platformOptions" multiple :placeholder="t('create.platform')" />
        </Field>
        <Field v-if="builtIns.has('event_date')" :label="t('create.eventDate')" for="edit-date">
          <input id="edit-date" v-model="date" type="date" :class="cn(fieldClass, 'h-9')" dir="ltr" />
        </Field>
        <Field v-if="builtIns.has('experiment_result')" :label="t('create.result')" for="edit-result">
          <Select id="edit-result" v-model="result" :options="resultOptions" :none-label="t('common.none')" :placeholder="t('create.result')" />
        </Field>
      </div>
      <Field v-if="builtIns.has('notes')" :label="t('create.information')" for="edit-notes">
        <Textarea id="edit-notes" v-model="notes" rows="3" dir="auto" />
      </Field>
      <MetadataFieldsPanel
        v-if="shownFields.length || hasUndeclared"
        v-model="values"
        v-model:types="types"
        :fields="shownFields"
        :title="t('detail.attributes')"
        :show-errors="tried"
      />
      <div class="flex flex-col gap-3">
        <StoredFilesEditor v-model:kept="kept" :stored="event?.additional_files ?? []" :label="t('edit.attached')" />
        <Dropzone v-model:files="picked" :label="t('edit.addFiles')" />
        <p v-if="duplicates" class="text-xs text-danger" dir="auto">{{ duplicates }}</p>
      </div>
      <Field :label="t('edit.reason')" required for="edit-reason">
        <Input id="edit-reason" v-model="reason" dir="auto" />
      </Field>
    </div>
    <template #footer>
      <div v-if="progress.visible.value" class="me-auto flex min-w-48 flex-1 flex-col gap-1">
        <Progress :value="progress.percent.value" />
        <span class="truncate text-xs text-muted-foreground" dir="auto">{{ progress.label.value }}</span>
      </div>
      <span v-else-if="blocked" class="me-auto text-xs text-muted-foreground">{{ blocked }}</span>
      <Button variant="ghost" :disabled="saving" @click="guard.attemptClose">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :loading="saving" :disabled="!!blocked" @click="save">{{ t('common.save') }}</Button>
    </template>
  </Dialog>
</template>
