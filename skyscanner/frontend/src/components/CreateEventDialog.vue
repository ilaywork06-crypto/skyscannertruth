<template>
  <v-dialog
    :model-value="modelValue"
    max-width="72rem"
    scrollable
    @update:model-value="attemptClose"
  >
    <v-card class="wizard">
      <div class="wizard__steps">
        <div
          v-for="(label, index) in STEP_LABELS"
          :key="label"
          class="wizard__step"
        >
          <span
            class="wizard__dot"
            :class="{ 'wizard__dot--active': step === index + 1 }"
          />
          <span class="wizard__step-label">{{ label }}</span>
          <span
            v-if="index < STEP_LABELS.length - 1"
            class="wizard__line"
          />
        </div>
      </div>

      <h2 class="wizard__title">
        {{ stepTitle }}
      </h2>

      <v-card-text class="wizard__body">
        <section
          v-if="step === 1"
          class="wizard__grid"
        >
          <div class="wizard__field">
            <label
              class="wizard__label"
              for="event-type"
            ><span class="wizard__required">*</span>{{ t('create.eventType') }}</label>
            <v-select
              id="event-type"
              v-model="eventTypeKey"
              :items="eventTypeItems"
              item-title="title"
              item-value="value"
            />
          </div>

          <div class="wizard__field">
            <label
              class="wizard__label"
              for="industry"
            ><span class="wizard__required">*</span>{{ t('create.industry') }}</label>
            <v-select
              id="industry"
              v-model="industry"
              :items="industryItems"
              item-title="title"
              item-value="value"
            >
              <template #item="{ item, props: itemProps }">
                <v-list-item
                  v-bind="itemProps"
                  :prepend-icon="item.raw.icon"
                />
              </template>
            </v-select>
          </div>

          <div class="wizard__field">
            <label
              class="wizard__label"
              for="platform"
            ><span class="wizard__required">*</span>{{ t('create.platform') }}</label>
            <!-- A platform belongs to its industries, so the list is offered once the industry is known. -->
            <v-select
              id="platform"
              v-model="platforms"
              :items="platformItems"
              item-title="title"
              item-value="value"
              :disabled="industry === null"
              :placeholder="industry === null ? t('create.pickIndustryFirst') : undefined"
              multiple
              chips
            />
          </div>

          <!--
            The brief is what the event is listed by, written by whoever files it and held to exactly as many
            characters as its column shows.
          -->
          <div class="wizard__field wizard__field--brief">
            <label
              class="wizard__label"
              for="event-brief"
            ><span class="wizard__required">*</span>{{ t('create.brief') }}</label>
            <v-text-field
              id="event-brief"
              v-model="name"
              :maxlength="BRIEF_MAX_LENGTH"
              :counter="BRIEF_MAX_LENGTH"
              dir="auto"
              hide-details="auto"
            />
          </div>

          <!--
            The moment the activity happened and the moment it was uploaded are two different things, so the
            date is asked for here while created at keeps recording the upload on its own.
          -->
          <div
            v-if="asks('event_date')"
            class="wizard__field"
          >
            <label
              class="wizard__label"
              for="event-date"
            >{{ t('create.eventDate') }}</label>
            <DateField
              id="event-date"
              v-model="eventDate"
            />
          </div>

          <!--
            An experiment result only means something on a type that describes an experiment, so it is one of
            the built in fields an event type switches on rather than one every event is asked for.
          -->
          <div
            v-if="asks('experiment_result')"
            class="wizard__field"
          >
            <label
              class="wizard__label"
              for="experiment-result"
            >{{ t('create.result') }}</label>
            <v-select
              id="experiment-result"
              v-model="experimentResult"
              :items="resultItems"
              item-title="title"
              item-value="value"
              clearable
            />
          </div>

          <div
            v-if="asks('notes')"
            class="wizard__field wizard__field--wide"
          >
            <label
              class="wizard__label"
              for="information"
            >{{ t('create.information') }}</label>
            <v-textarea
              id="information"
              v-model="notes"
              rows="3"
              auto-grow
              dir="auto"
            />
          </div>

          <!--
            The extra questions this event type asks beyond the built in ones. They are declared on the Types
            page as event fields and named by the type, so a new question about an event costs a declaration
            rather than another box wired into this form by hand.
          -->
          <div
            v-if="askedCustomFields.length > 0"
            class="wizard__field wizard__field--wide"
          >
            <span class="wizard__section-title">{{ t('detail.attributes') }}</span>
            <div class="wizard__custom-grid">
              <DynamicFieldInput
                v-for="field in askedCustomFields"
                :key="field.id"
                :field="field"
                :model-value="customValues[field.key] ?? null"
                @update:model-value="patchCustom(field, $event)"
              />
            </div>
          </div>

          <div class="wizard__field wizard__field--wide">
            <FileDropzone
              :label="t('create.files')"
              :files="eventFiles"
              @update:files="eventFiles = $event"
            />
          </div>
        </section>

        <section
          v-else
          class="wizard__additional"
        >
          <div class="wizard__entity-form">
            <EntityFormFields
              v-model="entityForm"
              :entity-types="entityTypes"
              :fields="entityFields"
              :modules="moduleOptions"
              id-prefix="wizard-entity"
            />

            <div class="wizard__entity-actions">
              <v-btn
                v-if="editedIndex !== null"
                variant="text"
                @click="cancelEntityEdit"
              >
                {{ t('common.cancel') }}
              </v-btn>
              <v-btn
                color="primary"
                :prepend-icon="editedIndex === null ? 'mdi-plus' : 'mdi-check'"
                :disabled="!canAddEntity"
                @click="commitEntity"
              >
                {{ editedIndex === null ? t('create.add') : t('create.update') }}
              </v-btn>
            </div>
          </div>

          <aside class="wizard__added">
            <SectionHeader
              class="wizard__added-title"
              :title="t('create.added')"
              :count="addedEntities.length"
            />
            <!--
              An entity that was added is not finished with: something was mistyped, or a file was forgotten.
              Each row therefore opens back into the form instead of only offering to be thrown away.
            -->
            <div
              v-for="(entity, index) in addedEntities"
              :key="`${entity.form.name}-${index}`"
              class="wizard__added-item"
              :class="{ 'wizard__added-item--edited': editedIndex === index }"
            >
              <button
                type="button"
                class="wizard__added-open"
                :aria-label="entity.form.name"
                @click="editEntity(index)"
              >
                <strong dir="auto">{{ entity.form.name }}</strong>
                <span class="wizard__added-hint">
                  <span dir="auto">{{ entity.typeName }}</span>
                  <span>
                    <v-icon
                      size="12"
                      icon="mdi-paperclip"
                    />
                    {{ fileCount(entity) }}
                  </span>
                </span>
              </button>
              <v-btn
                icon="mdi-close"
                size="x-small"
                variant="text"
                :aria-label="t('files.remove', { name: entity.form.name })"
                @click="removeEntity(index)"
              />
            </div>
            <p
              v-if="addedEntities.length === 0"
              class="wizard__empty"
            >
              {{ EMPTY_PLACEHOLDER }}
            </p>
          </aside>
        </section>
      </v-card-text>

      <v-card-actions class="wizard__actions">
        <v-btn
          v-if="step > 1"
          variant="outlined"
          @click="step -= 1"
        >
          {{ t('create.back') }}
        </v-btn>
        <!-- A pick large enough to be written part by part is a wait, so it is shown as one. -->
        <UploadProgress
          :visible="uploadVisible"
          :percent="uploadPercent"
          :label="uploadLabel"
        />
        <v-spacer />
        <v-btn
          v-if="step < STEP_LABELS.length"
          variant="outlined"
          :disabled="!canContinue"
          @click="goNext"
        >
          {{ t('create.next') }}
        </v-btn>
        <v-btn
          v-else
          color="primary"
          :loading="saving"
          :disabled="!canContinue"
          @click="submit"
        >
          {{ t('create.create') }}
        </v-btn>
      </v-card-actions>
    </v-card>

    <UnsavedChangesDialog
      v-model="confirmOpen"
      @discard="discard"
    />
  </v-dialog>
</template>

<script lang="ts">
import type { Artifact, ExperimentResult, FieldType, JsonValue, OptionalEventField } from '@/models/common'
import {
  DateField,
  DynamicFieldInput,
  EMPTY_PLACEHOLDER,
  SectionHeader,
  UiDropzone as FileDropzone,
  UnsavedChangesDialog,
  localName,
  toIsoDate,
  valueLabel,
} from '@truth-platform/core-ui'
import UploadProgress from '@/components/UploadProgress.vue'
import type { EntityCreateRequest, EntityType } from '@/models/entity'
import type { Platform } from '@/models/platform'
import { BRIEF_MAX_LENGTH, type EventDetail, type EventType } from '@/models/event'
import type { FieldDefinition } from '@truth-platform/core-ui'

interface Props {
  modelValue: boolean
  defaultIndustry?: string | null
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'created', created: EventDetail): void
}

/** One entity the wizard collected, kept in the very shape the shared form works with. */
interface EntityDraft {
  typeName: string
  form: EntityFormValue
}

/** One option of a picker, named in the language of the page. */
interface PickerItem<ValueT> {
  title: string
  value: ValueT
  icon?: string
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import EntityFormFields, { emptyEntityForm, type EntityFormValue } from '@/components/EntityFormFields.vue'
import { useDirtyGuard } from '@truth-platform/core-ui'
import { useSnackbar } from '@truth-platform/core-ui'
import { useUploadProgress } from '@/composables/useUploadProgress'
import { useIndustries } from '@/composables/useIndustries'
import { createEvent } from '@/requests/events'
import { listEntityTypes, listEventTypes, listFields, listPlatforms } from '@/requests/schema'
import { discardRefusedUploads, uploadArtifacts } from '@/requests/storage'
import { platformsOf } from '@/utils/platforms'
import { toMetadataAttributes, useLanguage } from '@truth-platform/core-ui'

const RESULT_OPTIONS: ExperimentResult[] = ['successful', 'partial', 'failed']

const props = withDefaults(defineProps<Props>(), { defaultIndustry: null })
const emit = defineEmits<Emits>()

const { industries, load: loadIndustries } = useIndustries()
const { notify, reportError } = useSnackbar()
const { t, language } = useLanguage()

/*
 * What an event is: the data it is filed under, and the entities that hang off it. The dynamic schema shapes
 * the entities, so those are the second step.
 */
const STEP_LABELS = computed<string[]>(() => [t('create.stepData'), t('create.stepEntities')])

const step = ref<number>(1)
const saving = ref<boolean>(false)

/* How far the files of this pick have got, which only shows itself once it is large enough to wait for. */
const {
  track: trackUpload,
  reset: resetUpload,
  visible: uploadVisible,
  percent: uploadPercent,
  label: uploadLabel,
} = useUploadProgress()

const eventTypes = ref<EventType[]>([])
const entityTypes = ref<EntityType[]>([])
const entityFields = ref<FieldDefinition[]>([])
/* Every event field declared for this industry, of which a type asks for the ones it named. */
const eventFields = ref<FieldDefinition[]>([])
const platformOptions = ref<Platform[]>([])

const eventTypeKey = ref<string | null>(null)
const industry = ref<string | null>(props.defaultIndustry)
const platforms = ref<string[]>([])
const name = ref<string>('')
const eventDate = ref<string>('')
const experimentResult = ref<ExperimentResult | null>(null)
const notes = ref<string>('')
const eventFiles = ref<File[]>([])

/* What was filled into the declared event fields, and the type each of those values is stored under. */
const customValues = ref<Record<string, JsonValue>>({})
const customTypes = ref<Record<string, FieldType>>({})

const entityForm = ref<EntityFormValue>(emptyEntityForm())
const addedEntities = ref<EntityDraft[]>([])

/* Which of the added entities the form is currently holding, or null while the form is collecting a new one. */
const editedIndex = ref<number | null>(null)

/* What the wizard looked like when it opened, which is what tells a touched form from an untouched one. */
const openedWith = ref<string>('')

const eventTypeItems = computed<PickerItem<string>[]>(() => {
  void language.value

  return eventTypes.value.map((type) => ({ title: localName(type), value: type.key }))
})

const industryItems = computed<PickerItem<string>[]>(() => {
  void language.value

  return industries.value.map((item) => ({ title: localName(item), value: item.key, icon: item.icon }))
})

const platformItems = computed<PickerItem<string>[]>(() => {
  void language.value

  return platformsOf(platformOptions.value, industry.value).map((platform) => ({
    title: localName(platform),
    value: platform.key,
  }))
})

const resultItems = computed<PickerItem<ExperimentResult>[]>(() => {
  void language.value

  return RESULT_OPTIONS.map((value) => ({ title: valueLabel(value), value }))
})

const stepTitle = computed<string>(() => (step.value === 1 ? t('create.title') : t('create.entitiesTitle')))

/* The built in fields the chosen type asks for, which is what decides whether they are on the form at all. */
const askedFields = computed<OptionalEventField[]>(
  () => eventTypes.value.find((candidate) => candidate.key === eventTypeKey.value)?.fields ?? [],
)

const asks = (field: OptionalEventField): boolean => askedFields.value.includes(field)

/* The keys of the declared event fields the chosen type asks for, in the order the type named them. */
const askedCustomKeys = computed<string[]>(
  () => eventTypes.value.find((candidate) => candidate.key === eventTypeKey.value)?.custom_fields ?? [],
)

/*
 * The declarations behind those keys. A key whose declaration was removed since the type named it simply
 * finds nothing here and is not asked for, which is what keeps a stale name off the form.
 */
const askedCustomFields = computed<FieldDefinition[]>(() =>
  askedCustomKeys.value
    .map((key) => eventFields.value.find((field) => field.key === key))
    .filter((field): field is FieldDefinition => field !== undefined),
)

const patchCustom = (field: FieldDefinition, value: JsonValue) => {
  customValues.value = { ...customValues.value, [field.key]: value }
  customTypes.value = { ...customTypes.value, [field.key]: field.type }
}

/**
 * Describe the whole wizard as one comparable string.
 *
 * Files carry no value equality of their own, so they are described by what identifies them to the user -
 * the name and the size - rather than by the object the picker handed over.
 */
const describeFiles = (files: File[]): string[] => files.map((file) => `${file.name}:${file.size}`)

/** Describe one entity form, with its files reduced to what identifies them. */
const describeForm = (form: EntityFormValue): JsonValue => ({
  ...form,
  rawFiles: describeFiles(form.rawFiles),
  parsedFiles: describeFiles(form.parsedFiles),
  parsedAdditionalFiles: describeFiles(form.parsedAdditionalFiles),
})

const snapshot = (): string =>
  JSON.stringify({
    eventTypeKey: eventTypeKey.value,
    industry: industry.value,
    platforms: [...platforms.value],
    name: name.value,
    eventDate: eventDate.value,
    experimentResult: experimentResult.value,
    notes: notes.value,
    customValues: { ...customValues.value },
    files: describeFiles(eventFiles.value),
    entityForm: describeForm(entityForm.value),
    addedEntities: addedEntities.value.map((draft) => describeForm(draft.form)),
  })

const moduleOptions = computed<string[]>(() =>
  industry.value === null ? [] : (industries.value.find((item) => item.key === industry.value)?.modules ?? []),
)

/* The same rule the service enforces: an entity needs a type and a name before it can be added. */
const canAddEntity = computed<boolean>(
  () => entityForm.value.typeKey !== null && entityForm.value.name.trim().length > 0,
)

const fileCount = (entity: EntityDraft): number =>
  entity.form.rawFiles.length + entity.form.parsedFiles.length + entity.form.parsedAdditionalFiles.length

/* A brief is written, and it fits its column. */
const briefIsValid = computed<boolean>(() => {
  const written = name.value.trim()

  return written.length > 0 && written.length <= BRIEF_MAX_LENGTH
})

const canContinue = computed<boolean>(() => {
  if (step.value === 1) {
    return (
      eventTypeKey.value !== null && industry.value !== null && platforms.value.length > 0 && briefIsValid.value
    )
  }

  return true
})

const loadSchema = async (): Promise<void> => {
  try {
    const selected = industry.value
    const [types, entities, declaredPlatforms, declaredEventFields] = await Promise.all([
      listEventTypes(selected),
      listEntityTypes(selected),
      listPlatforms(selected),
      listFields({ scope: 'event', industry: selected }),
    ])
    eventTypes.value = types
    entityTypes.value = entities
    platformOptions.value = declaredPlatforms
    eventFields.value = declaredEventFields
    /* A platform that the newly chosen industry was never offered cannot stay picked for it. */
    const offered = new Set(platformsOf(declaredPlatforms, selected).map((candidate) => candidate.key))
    platforms.value = platforms.value.filter((key) => offered.has(key))
  } catch (error) {
    reportError(error)
  }
}

const loadEntityFields = async (): Promise<void> => {
  const typeKey = entityForm.value.typeKey
  if (typeKey === null) {
    entityFields.value = []
    return
  }

  try {
    entityFields.value = await listFields({
      scope: 'entity',
      industry: industry.value,
      entityType: typeKey,
    })
  } catch (error) {
    reportError(error)
  }
}

const reset = () => {
  step.value = 1
  eventTypeKey.value = null
  industry.value = props.defaultIndustry
  platforms.value = []
  name.value = ''
  eventDate.value = ''
  experimentResult.value = null
  notes.value = ''
  eventFiles.value = []
  customValues.value = {}
  customTypes.value = {}
  entityForm.value = emptyEntityForm()
  addedEntities.value = []
  editedIndex.value = null
  openedWith.value = snapshot()
}

const close = () => {
  emit('update:modelValue', false)
}

const { confirmOpen, attemptClose, discard } = useDirtyGuard({
  isDirty: () => snapshot() !== openedWith.value,
  close,
})

const goNext = () => {
  step.value += 1
}

/** Empty the form for the next entity, keeping the type because three telemetries in a row is the common case. */
const clearEntityForm = () => {
  entityForm.value = { ...emptyEntityForm(), typeKey: entityForm.value.typeKey }
  editedIndex.value = null
}

/**
 * Put what the form holds into the list, either as a new entity or over the one being edited.
 */
const commitEntity = () => {
  const typeKey = entityForm.value.typeKey
  if (typeKey === null || !canAddEntity.value) {
    return
  }

  const declared = entityTypes.value.find((candidate) => candidate.key === typeKey)
  const draft: EntityDraft = {
    typeName: declared?.name ?? typeKey,
    form: { ...entityForm.value, name: entityForm.value.name.trim() },
  }
  const edited = editedIndex.value
  addedEntities.value =
    edited === null
      ? [...addedEntities.value, draft]
      : addedEntities.value.map((current, index) => (index === edited ? draft : current))

  clearEntityForm()
}

/**
 * Load an entity that was already added back into the form, so that it can be corrected rather than
 * removed and typed again from the start.
 */
const editEntity = (index: number) => {
  const draft = addedEntities.value[index]
  if (draft === undefined) {
    return
  }

  entityForm.value = { ...draft.form }
  editedIndex.value = index
}

const cancelEntityEdit = () => {
  clearEntityForm()
}

const removeEntity = (index: number) => {
  addedEntities.value = addedEntities.value.filter((_, candidate) => candidate !== index)

  /*
   * The form is holding one of these entities, and the list it points into just changed underneath it. The
   * entity it was editing is gone, so the form goes back to collecting a new one; anything after the removed
   * row has moved one place towards the front.
   */
  const edited = editedIndex.value
  if (edited === null) {
    return
  }

  if (edited === index) {
    clearEntityForm()

    return
  }

  editedIndex.value = edited > index ? edited - 1 : edited
}

/**
 * Upload the files of every entity in the list and describe each entity as the service takes it.
 *
 * Every file written is also added to `uploaded`, so a save the service refuses can take all of them back.
 */
const buildEntityRequests = async (uploaded: Artifact[]): Promise<EntityCreateRequest[]> => {
  const requests: EntityCreateRequest[] = []
  for (const draft of addedEntities.value) {
    const owner = { ownerKind: 'entities' as const, ownerId: null }
    const [raw, parsed, additional] = await Promise.all([
      uploadArtifacts(draft.form.rawFiles, {
        ...owner,
        kind: 'raw',
        folder: 'raw_files',
        onProgress: trackUpload(),
        descriptor: `Raw files of ${draft.form.name}`,
      }),
      uploadArtifacts(draft.form.parsedFiles, {
        ...owner,
        kind: 'parsed',
        folder: 'parsed_files',
        onProgress: trackUpload(),
        descriptor: `Parsed files of ${draft.form.name}`,
      }),
      uploadArtifacts(draft.form.parsedAdditionalFiles, {
        ...owner,
        kind: 'parsed_additional',
        folder: 'parsed_additional_files',
        onProgress: trackUpload(),
        descriptor: `Extra parsing products of ${draft.form.name}`,
      }),
    ])
    uploaded.push(...raw, ...parsed, ...additional)
    requests.push({
      name: draft.form.name,
      entity_type_key: draft.form.typeKey ?? '',
      module: draft.form.module,
      code_version: draft.form.codeVersion.length > 0 ? draft.form.codeVersion : null,
      status: draft.form.status,
      notes: draft.form.notes,
      upload_source: 'manual',
      requested_at: null,
      received_at: null,
      raw_files: raw,
      parsed_files: parsed,
      parsed_additional_files: additional,
      metadata: toMetadataAttributes(draft.form.values, draft.form.valueTypes),
    })
  }

  return requests
}

const submit = async (): Promise<void> => {
  if (eventTypeKey.value === null || industry.value === null) {
    return
  }

  /*
   * An entity still standing in the form is taken along. One loaded back for a correction would otherwise be
   * stored as it was before the correction, and a new one that was named and given files - but whose Add was
   * never pressed - used to be dropped without a word, files and all. A form nobody wrote a name into is empty
   * and adds nothing.
   */
  if (canAddEntity.value) {
    commitEntity()
  }

  saving.value = true
  const uploaded: Artifact[] = []
  try {
    const additionalFiles = await uploadArtifacts(eventFiles.value, {
      ownerKind: 'events',
      ownerId: null,
      kind: 'additional',
      folder: null,
      onProgress: trackUpload(),
      descriptor: 'Files attached while the event was created',
    })
    uploaded.push(...additionalFiles)
    const entities = await buildEntityRequests(uploaded)
    const created = await createEvent({
      name: name.value.trim(),
      event_type_keys: [eventTypeKey.value],
      industry: industry.value,
      platforms: [...platforms.value],
      /* An event is still stored with a status, which nobody is asked for any more. */
      status: 'draft',
      experiment_result: experimentResult.value,
      event_date: toIsoDate(eventDate.value),
      notes: notes.value,
      upload_source: 'manual',
      additional_files: additionalFiles,
      metadata: toMetadataAttributes(customValues.value, customTypes.value),
      entities,
    })
    notify(t('create.created', { name: created.name }), 'success')
    emit('created', created)
    close()
    reset()
  } catch (error) {
    discardRefusedUploads(error, uploaded)
    reportError(error)
  } finally {
    saving.value = false
    resetUpload()
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      reset()
      await loadIndustries()
      await loadSchema()
    }
  },
)

watch(industry, loadSchema)
watch(() => entityForm.value.typeKey, loadEntityFields)

/*
 * A field the chosen type does not ask for is not on the form, so anything typed into it before the type was
 * changed has to go with it rather than being submitted from a box nobody can see any more.
 */
watch(askedFields, () => {
  if (!asks('event_date')) {
    eventDate.value = ''
  }
  if (!asks('experiment_result')) {
    experimentResult.value = null
  }
  if (!asks('notes')) {
    notes.value = ''
  }
})

/*
 * The declared fields go the same way as the built in ones: a value typed into a field the newly chosen type
 * does not ask for is dropped rather than submitted from a box that is no longer on the form.
 */
watch(askedCustomKeys, (keys) => {
  const asked = new Set(keys)
  customValues.value = Object.fromEntries(
    Object.entries(customValues.value).filter(([key]) => asked.has(key)),
  )
  customTypes.value = Object.fromEntries(
    Object.entries(customTypes.value).filter(([key]) => asked.has(key)),
  )
})
</script>

<style scoped>
.wizard {
  padding-block: 1.5rem;
  background-color: rgb(var(--v-theme-surface));
}

.wizard__steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding-inline: 3rem;
}

.wizard__step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 0;
  max-inline-size: 15rem;
  min-inline-size: 0;
}


/* The declared fields sit under one heading rather than being scattered among the built in boxes. */
.wizard__section-title {
  font-size: 0.875rem;
  font-weight: 600;
}

.wizard__custom-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
}

.wizard__dot {
  inline-size: 1.25rem;
  block-size: 1.25rem;
  border-radius: 50%;
  background-color: rgba(var(--v-theme-on-surface), 0.75);
  z-index: 1;
}

.wizard__dot--active {
  background-color: rgb(var(--v-theme-primary));
}

.wizard__step-label {
  font-size: 0.8125rem;
  white-space: nowrap;
}

.wizard__line {
  position: absolute;
  inset-block-start: 0.5625rem;
  inset-inline-start: 50%;
  inline-size: 100%;
  block-size: 0.09375rem;
  background-color: rgba(var(--v-theme-on-surface), 0.6);
}

.wizard__title {
  text-align: center;
  font-size: 1.75rem;
  font-weight: 600;
  padding-block: 1.5rem 0.5rem;
}

.wizard__body {
  max-block-size: 60vh;
}

.wizard__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: 1.25rem;
}

.wizard__field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-inline-size: 0;
}

.wizard__field--wide {
  grid-column: 1 / -1;
}

/* A brief is fifty characters, so its box is given the room of two fields. */
.wizard__field--brief {
  grid-column: span 2;
}

/*
 * A label that carries an information icon is taller than a plain one, which would start the control under it
 * lower than the control beside it. Reserving the icon's height for every label keeps the row aligned.
 */
.wizard__label {
  font-size: 0.875rem;
  line-height: 1.5;
  min-block-size: 1.5rem;
}

.wizard__required {
  color: rgb(var(--v-theme-error));
  margin-inline-end: 0.125rem;
}

.wizard__additional {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 1.5rem;
}

.wizard__entity-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background-color: rgba(var(--v-theme-on-surface), 0.04);
  border-radius: 0.75rem;
  padding: 1.25rem;
}

.wizard__entity-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.wizard__added {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border-inline-start: 0.0625rem solid rgba(var(--v-theme-on-surface), 0.15);
  padding-inline-start: 1.5rem;
}

.wizard__added-title {
  border-block-end: 0.0625rem solid rgba(var(--v-theme-on-surface), 0.25);
  padding-block-end: 0.5rem;
}

.wizard__added-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border-block-end: 0.0625rem solid rgba(var(--v-theme-on-surface), 0.15);
  padding-block-end: 0.5rem;
}

/* The entity being edited is marked, because the form and the list are otherwise two unrelated things. */
.wizard__added-item--edited {
  border-inline-start: 0.1875rem solid rgb(var(--v-theme-primary));
  padding-inline-start: 0.5rem;
}

.wizard__added-open {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  flex: 1 1 auto;
  min-inline-size: 0;
  text-align: start;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.wizard__added-open:hover,
.wizard__added-open:focus-visible {
  color: rgb(var(--v-theme-primary));
}

.wizard__added-hint {
  display: flex;
  gap: 0.5rem;
  font-size: 0.8125rem;
  opacity: 0.7;
}

.wizard__empty {
  opacity: 0.7;
  font-size: 0.875rem;
}

.wizard__actions {
  padding-inline: 1.5rem;
}

@media (max-width: 60rem) {
  .wizard__field--brief {
    grid-column: 1 / -1;
  }

  .wizard__additional {
    grid-template-columns: 1fr;
  }

  .wizard__added {
    border-inline-start: none;
    padding-inline-start: 0;
  }

  .wizard__line {
    inline-size: 6rem;
  }
}
</style>
