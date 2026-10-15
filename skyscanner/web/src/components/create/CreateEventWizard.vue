<script setup lang="ts">
/**
 * "Create an event" - two steps. Data: event type, industry, platforms, brief, the built-in fields the type
 * asks for, its declared fields (in the type's order) and the event's files. Entities: an entity form on one
 * side, the drafted entities on the other (click to edit, x to drop). CREATE uploads the files (event files,
 * then each entity's three picks), then posts the event with its entities; a refused save takes its uploads
 * back. Unsaved changes are asked about before closing.
 */
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Paperclip, Plus, X } from 'lucide-vue-next'
import {
  Button, Combobox, Dialog, EMPTY_PLACEHOLDER, Field, Input, Progress, Select, Textarea, cn, localName, notify,
  reportError, toIsoDate, translate as t, useDirtyGuard, valueLabel, type ComboOption, type SelectOption,
} from '@truth-platform/ui'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import { createEvent, toMetadataAttributes, type EntityCreateRequest, type ExperimentResult } from '@/api/create'
import { discardRefusedUploads, type Artifact } from '@/api/storage'
import {
  listEntityTypes, listEventTypes, listFields, listPlatforms, servesIndustry, useIndustries,
  type EntityType, type EventType, type FieldDefinition, type Industry, type FieldType, type JsonValue, type OptionalEventField, type Platform,
} from '@/api/taxonomy'
import { uploadArtifacts } from '@/api/uploads'
import { useUploadProgress } from '@/composables/useUploads'
import { iconFor } from '@/lib/icons'
import DynamicFieldInput from './DynamicFieldInput.vue'
import Dropzone from './Dropzone.vue'
import EntityFormFields from './EntityFormFields.vue'
import { describeEntityForm, emptyEntityForm, type EntityFormValue } from './entityForm'

const BRIEF_MAX_LENGTH = 50
const RESULTS: ExperimentResult[] = ['successful', 'partial', 'failed']

const props = defineProps<{ industry?: string | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [id: string] }>()

const queryClient = useQueryClient()
const { industries } = useIndustries()
const progress = useUploadProgress()

interface EntityDraft {
  typeName: string
  form: EntityFormValue
}

const step = ref(1)
const saving = ref(false)
const triedNext = ref(false)

const eventTypes = shallowRef<EventType[]>([])
const entityTypes = shallowRef<EntityType[]>([])
const platformsOffered = shallowRef<Platform[]>([])
const eventFields = shallowRef<FieldDefinition[]>([])
const entityFields = shallowRef<FieldDefinition[]>([])

const eventTypeKey = ref<string | null>(null)
const industry = ref<string | null>(null)
const platforms = ref<string[]>([])
const name = ref('')
const eventDate = ref('')
const result = ref<ExperimentResult | null>(null)
const notes = ref('')
const eventFiles = ref<File[]>([])
const customValues = ref<Record<string, JsonValue>>({})
const customTypes = ref<Record<string, FieldType>>({})

const entityForm = ref<EntityFormValue>(emptyEntityForm())
const drafts = ref<EntityDraft[]>([])
const editedIndex = ref<number | null>(null)
const openedWith = ref('')

/* ------------------------------------------------------------- options */
const typeOptions = computed<ComboOption<string>[]>(() => eventTypes.value.map((x) => ({ value: x.key, label: localName(x) })))
const industryOptions = computed<ComboOption<string>[]>(() => industries.value.map((x) => ({ value: x.key, label: localName(x), hint: x.key })))
const platformOptions = computed<ComboOption<string>[]>(() =>
  platformsOffered.value.filter((p) => servesIndustry(p, industry.value)).map((p) => ({ value: p.key, label: localName(p) })),
)
const resultOptions = computed<SelectOption<ExperimentResult>[]>(() => RESULTS.map((r) => ({ value: r, label: valueLabel(r) })))
const chosenIndustry = computed<Industry | null>(() => (industries.value as Industry[]).find((i) => i.key === industry.value) ?? null)
const modules = computed(() => chosenIndustry.value?.modules ?? [])

const chosenType = computed(() => eventTypes.value.find((x) => x.key === eventTypeKey.value) ?? null)
const asked = computed<OptionalEventField[]>(() => chosenType.value?.fields ?? [])
const asks = (f: OptionalEventField) => asked.value.includes(f)
const askedCustomKeys = computed(() => chosenType.value?.custom_fields ?? [])
const askedCustomFields = computed(() =>
  askedCustomKeys.value.map((k) => eventFields.value.find((f) => f.key === k)).filter((f): f is FieldDefinition => !!f),
)

const brief = computed(() => name.value.trim())
const briefValid = computed(() => brief.value.length > 0 && brief.value.length <= BRIEF_MAX_LENGTH)
const missingRequired = computed(() =>
  askedCustomFields.value.filter((f) => {
    if (!f.required) return false
    const v = customValues.value[f.key]
    return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
  }),
)
const stepOneReady = computed(() => !!eventTypeKey.value && !!industry.value && platforms.value.length > 0 && briefValid.value)
const canAddEntity = computed(() => !!entityForm.value.typeKey && entityForm.value.name.trim().length > 0)
const fileCount = (d: EntityDraft) => d.form.rawFiles.length + d.form.parsedFiles.length + d.form.parsedAdditionalFiles.length

/* ------------------------------------------------------------- dirty guard */
const snapshot = () =>
  JSON.stringify({
    eventTypeKey: eventTypeKey.value,
    industry: industry.value,
    platforms: platforms.value,
    name: name.value,
    eventDate: eventDate.value,
    result: result.value,
    notes: notes.value,
    customValues: customValues.value,
    files: eventFiles.value.map((f) => `${f.name}:${f.size}`),
    entityForm: describeEntityForm(entityForm.value),
    drafts: drafts.value.map((d) => describeEntityForm(d.form)),
  })
const { attemptClose } = useDirtyGuard({
  isDirty: () => !saving.value && snapshot() !== openedWith.value,
  close: () => {
    if (!saving.value) open.value = false
  },
})

/* ------------------------------------------------------------- loading */
let schemaToken = 0
async function loadSchema() {
  const token = ++schemaToken
  const selected = industry.value
  try {
    const [types, entities, offered, fields] = await Promise.all([
      listEventTypes(selected),
      listEntityTypes(selected),
      listPlatforms(selected),
      listFields({ scope: 'event', industry: selected, include_shared: true }),
    ])
    if (token !== schemaToken) return
    eventTypes.value = types
    entityTypes.value = entities
    platformsOffered.value = offered
    eventFields.value = fields
    const serving = new Set(offered.filter((p) => servesIndustry(p, selected)).map((p) => p.key))
    platforms.value = platforms.value.filter((k) => serving.has(k))
  } catch (error) {
    reportError(error)
  }
}

let fieldsToken = 0
async function loadEntityFields() {
  const token = ++fieldsToken
  const typeKey = entityForm.value.typeKey
  if (!typeKey) {
    entityFields.value = []
    return
  }
  try {
    const fields = await listFields({ scope: 'entity', industry: industry.value, entity_type: typeKey, include_shared: true })
    if (token === fieldsToken) entityFields.value = fields
  } catch (error) {
    reportError(error)
  }
}

function reset() {
  step.value = 1
  triedNext.value = false
  eventTypeKey.value = null
  industry.value = props.industry ?? null
  platforms.value = []
  name.value = ''
  eventDate.value = ''
  result.value = null
  notes.value = ''
  eventFiles.value = []
  customValues.value = {}
  customTypes.value = {}
  entityForm.value = emptyEntityForm()
  drafts.value = []
  editedIndex.value = null
  progress.reset()
  openedWith.value = snapshot()
}

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    reset()
    void loadSchema()
  },
  { immediate: true },
)
watch(industry, () => {
  if (open.value) void loadSchema()
})
watch(() => entityForm.value.typeKey, loadEntityFields)
watch(asked, () => {
  if (!asks('event_date')) eventDate.value = ''
  if (!asks('experiment_result')) result.value = null
  if (!asks('notes')) notes.value = ''
})
watch(askedCustomKeys, (keys) => {
  const keep = new Set(keys)
  customValues.value = Object.fromEntries(Object.entries(customValues.value).filter(([k]) => keep.has(k)))
  customTypes.value = Object.fromEntries(Object.entries(customTypes.value).filter(([k]) => keep.has(k)))
})

function patchCustom(field: FieldDefinition, value: JsonValue) {
  customValues.value = { ...customValues.value, [field.key]: value }
  customTypes.value = { ...customTypes.value, [field.key]: field.type }
}

function next() {
  triedNext.value = true
  if (!stepOneReady.value || missingRequired.value.length) return
  step.value = 2
}

/* ------------------------------------------------------------- entity drafts */
function clearEntityForm() {
  entityForm.value = { ...emptyEntityForm(), typeKey: entityForm.value.typeKey }
  editedIndex.value = null
}
function commitEntity() {
  const typeKey = entityForm.value.typeKey
  if (!typeKey || !canAddEntity.value) return
  const declared = entityTypes.value.find((x) => x.key === typeKey)
  const draft: EntityDraft = { typeName: declared ? localName(declared) : typeKey, form: { ...entityForm.value, name: entityForm.value.name.trim() } }
  const edited = editedIndex.value
  drafts.value = edited === null ? [...drafts.value, draft] : drafts.value.map((d, i) => (i === edited ? draft : d))
  clearEntityForm()
}
function editEntity(index: number) {
  const d = drafts.value[index]
  if (!d) return
  entityForm.value = { ...d.form }
  editedIndex.value = index
}
function removeEntity(index: number) {
  drafts.value = drafts.value.filter((_, i) => i !== index)
  const edited = editedIndex.value
  if (edited === null) return
  if (edited === index) clearEntityForm()
  else if (edited > index) editedIndex.value = edited - 1
}

/* ------------------------------------------------------------- create */
async function buildEntities(uploaded: Artifact[]): Promise<EntityCreateRequest[]> {
  const out: EntityCreateRequest[] = []
  for (const draft of drafts.value) {
    const owner = { ownerKind: 'entities', ownerId: null } as const
    const [raw, parsed, products] = await Promise.all([
      uploadArtifacts(draft.form.rawFiles, { ...owner, kind: 'raw', folder: 'raw_files', descriptor: `Raw files of ${draft.form.name}`, onProgress: progress.track() }),
      uploadArtifacts(draft.form.parsedFiles, { ...owner, kind: 'parsed', folder: 'parsed_files', descriptor: `Parsed files of ${draft.form.name}`, onProgress: progress.track() }),
      uploadArtifacts(draft.form.parsedAdditionalFiles, {
        ...owner,
        kind: 'parsed_additional',
        folder: 'parsed_additional_files',
        descriptor: `Extra parsing products of ${draft.form.name}`,
        onProgress: progress.track(),
      }),
    ])
    uploaded.push(...raw, ...parsed, ...products)
    out.push({
      name: draft.form.name,
      entity_type_key: draft.form.typeKey ?? '',
      module: draft.form.module,
      code_version: draft.form.codeVersion.length ? draft.form.codeVersion : null,
      status: draft.form.status,
      notes: draft.form.notes,
      upload_source: 'manual',
      requested_at: null,
      received_at: null,
      raw_files: raw,
      parsed_files: parsed,
      parsed_additional_files: products,
      metadata: toMetadataAttributes(draft.form.values, draft.form.valueTypes),
    })
  }
  return out
}

async function submit() {
  if (!eventTypeKey.value || !industry.value || saving.value) return
  if (canAddEntity.value) commitEntity()
  saving.value = true
  const uploaded: Artifact[] = []
  try {
    const additional = await uploadArtifacts(eventFiles.value, {
      ownerKind: 'events',
      ownerId: null,
      kind: 'additional',
      folder: null,
      descriptor: 'Files attached while the event was created',
      onProgress: progress.track(),
    })
    uploaded.push(...additional)
    const entities = await buildEntities(uploaded)
    const created = await createEvent({
      name: brief.value,
      event_type_keys: [eventTypeKey.value],
      industry: industry.value,
      platforms: [...platforms.value],
      status: 'draft',
      experiment_result: result.value,
      event_date: toIsoDate(eventDate.value),
      notes: notes.value,
      upload_source: 'manual',
      additional_files: additional,
      metadata: toMetadataAttributes(customValues.value, customTypes.value),
      entities,
    })
    notify(t('create.created', { name: created.name }), 'success')
    void queryClient.invalidateQueries({ queryKey: ['taxonomy', 'industries'] })
    emit('created', created.id)
    saving.value = false
    open.value = false
  } catch (error) {
    discardRefusedUploads(error, uploaded)
    reportError(error)
  } finally {
    saving.value = false
    progress.reset()
  }
}

const steps = computed(() => [t('create.stepData'), t('create.stepEntities')])
</script>

<template>
  <Dialog
    v-model:open="open"
    size="2xl"
    persistent
    class="max-w-[72rem]"
    :title="step === 1 ? t('create.title') : t('create.entitiesTitle')"
    @attempt-close="attemptClose"
  >
    <template #icon><CalendarPlus /></template>
    <template #description>
      <ol class="mt-1 flex items-center gap-2 text-xs" :aria-label="t('create.title')">
        <li v-for="(label, i) in steps" :key="label" class="flex items-center gap-2">
          <span
            :class="cn(
              'grid size-5 place-items-center rounded-full text-[11px] font-semibold',
              step === i + 1 ? 'bg-primary text-primary-foreground' : step > i + 1 ? 'bg-primary-soft text-primary-soft-foreground' : 'bg-subtle text-muted-foreground',
            )"
            :aria-current="step === i + 1 ? 'step' : undefined"
          >
            <Check v-if="step > i + 1" class="size-3" />
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span :class="step === i + 1 ? 'font-medium text-foreground' : 'text-muted-foreground'">{{ label }}</span>
          <span v-if="i < steps.length - 1" class="h-px w-8 bg-border" />
        </li>
      </ol>
    </template>

    <!-- Step 1 - Data -->
    <div v-if="step === 1" class="flex flex-col gap-5 pb-1">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field :label="t('create.eventType')" required for="create-type" :error="triedNext && !eventTypeKey ? t('input.required', { name: t('create.eventType') }) : null">
          <Combobox id="create-type" v-model="eventTypeKey" :options="typeOptions" :clearable="false" :placeholder="t('create.eventType')" :invalid="triedNext && !eventTypeKey" />
        </Field>
        <Field :label="t('create.industry')" required for="create-industry" :error="triedNext && !industry ? t('input.required', { name: t('create.industry') }) : null">
          <Combobox id="create-industry" v-model="industry" :options="industryOptions" :clearable="false" :placeholder="t('create.industry')" :invalid="triedNext && !industry" />
          <template #aside>
            <component :is="iconFor(chosenIndustry?.icon)" v-if="chosenIndustry" class="size-4 text-muted-foreground" />
          </template>
        </Field>
        <Field :label="t('create.platform')" required for="create-platforms" :error="triedNext && industry && !platforms.length ? t('input.required', { name: t('create.platform') }) : null">
          <Combobox
            id="create-platforms"
            v-model="platforms"
            multiple
            :options="platformOptions"
            :disabled="!industry"
            :placeholder="industry ? t('create.platform') : t('create.pickIndustryFirst')"
            :invalid="!!(triedNext && industry && !platforms.length)"
          />
        </Field>
      </div>

      <Field :label="t('create.brief')" required for="create-brief" :error="triedNext && !briefValid ? t('edit.briefInvalid') : null">
        <template #aside>
          <span :class="cn('text-xs tabular-nums', name.length > BRIEF_MAX_LENGTH ? 'text-danger' : 'text-muted-foreground')">{{ name.length }} / {{ BRIEF_MAX_LENGTH }}</span>
        </template>
        <Input id="create-brief" v-model="name" :maxlength="BRIEF_MAX_LENGTH" dir="auto" :invalid="triedNext && !briefValid" />
      </Field>

      <div v-if="asks('event_date') || asks('experiment_result')" class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field v-if="asks('event_date')" :label="t('create.eventDate')" for="create-date">
          <Input id="create-date" v-model="eventDate" type="date" dir="ltr" />
        </Field>
        <Field v-if="asks('experiment_result')" :label="t('create.result')" for="create-result">
          <Select id="create-result" v-model="result" :options="resultOptions" :none-label="EMPTY_PLACEHOLDER" :placeholder="t('create.result')" />
        </Field>
      </div>

      <Field v-if="asks('notes')" :label="t('create.information')" for="create-notes">
        <Textarea id="create-notes" v-model="notes" rows="3" dir="auto" :placeholder="t('input.notesPlaceholder')" />
      </Field>

      <section v-if="askedCustomFields.length" class="rounded-xl border border-border bg-muted/20 p-4">
        <h4 class="mb-3 text-sm font-semibold">{{ t('detail.attributes') }}</h4>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DynamicFieldInput
            v-for="field in askedCustomFields"
            :key="field.id"
            :field="field"
            :model-value="customValues[field.key]"
            :show-errors="triedNext"
            @update:model-value="(v) => patchCustom(field, v)"
          />
        </div>
      </section>

      <Dropzone v-model:files="eventFiles" :label="t('create.files')" />
    </div>

    <!-- Step 2 - Entities -->
    <div v-else class="grid grid-cols-1 gap-6 pb-1 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div class="flex flex-col gap-4">
        <EntityFormFields
          v-model="entityForm"
          :entity-types="entityTypes"
          :fields="entityFields"
          :modules="modules"
          :context="customValues"
          id-prefix="create-entity"
        />
        <div class="flex justify-end gap-2">
          <template v-if="editedIndex !== null">
            <Button variant="ghost" @click="clearEntityForm">{{ t('common.cancel') }}</Button>
            <Button variant="soft" :disabled="!canAddEntity" @click="commitEntity"><Check /> {{ t('create.update') }}</Button>
          </template>
          <Button v-else variant="soft" :disabled="!canAddEntity" @click="commitEntity"><Plus /> {{ t('create.add') }}</Button>
        </div>
      </div>
      <aside class="flex flex-col gap-2 lg:border-s lg:border-border lg:ps-6">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold">{{ t('create.added') }}</h4>
          <span class="rounded-full bg-subtle px-2 text-xs leading-5 tabular-nums text-muted-foreground">{{ drafts.length }}</span>
        </div>
        <p v-if="!drafts.length" class="text-sm text-muted-foreground">{{ EMPTY_PLACEHOLDER }}</p>
        <div
          v-for="(draft, i) in drafts"
          :key="i"
          :class="cn(
            'group flex items-start gap-2 rounded-xl border p-2.5 transition-colors',
            editedIndex === i ? 'border-primary bg-primary-soft/50' : 'border-border bg-card hover:bg-muted/50',
          )"
        >
          <button type="button" class="min-w-0 flex-1 text-start" @click="editEntity(i)">
            <div class="truncate text-sm font-semibold" dir="auto">{{ draft.form.name }}</div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span class="truncate" dir="auto">{{ draft.typeName }}</span>
              <span class="inline-flex items-center gap-0.5 tabular-nums"><Paperclip class="size-3" />{{ fileCount(draft) }}</span>
            </div>
          </button>
          <button type="button" class="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" :aria-label="t('common.remove')" @click="removeEntity(i)">
            <X class="size-3.5" />
          </button>
        </div>
      </aside>
    </div>

    <template #footer>
      <div v-if="progress.visible.value" class="me-auto flex min-w-48 flex-1 flex-col gap-1">
        <Progress :value="progress.percent.value" />
        <span class="truncate text-xs text-muted-foreground" dir="auto">{{ progress.label.value }}</span>
      </div>
      <Button variant="ghost" :disabled="saving" @click="attemptClose">{{ t('common.cancel') }}</Button>
      <Button v-if="step > 1" variant="outline" :disabled="saving" @click="step = 1"><ChevronLeft class="rtl:rotate-180" /> {{ t('create.back') }}</Button>
      <Button v-if="step === 1" variant="primary" :disabled="triedNext && (!stepOneReady || missingRequired.length > 0)" @click="next">
        {{ t('create.next') }} <ChevronRight class="rtl:rotate-180" />
      </Button>
      <Button v-else variant="primary" :loading="saving" @click="submit">{{ t('create.create') }}</Button>
    </template>
  </Dialog>
</template>
