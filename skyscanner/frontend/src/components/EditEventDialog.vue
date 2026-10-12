<template>
  <v-dialog
    :model-value="modelValue"
    max-width="56rem"
    scrollable
    @update:model-value="attemptClose"
  >
    <v-card class="edit-event">
      <v-card-title class="edit-event__title">
        {{ t('edit.title') }}
      </v-card-title>

      <v-card-text class="edit-event__body">
        <div class="edit-event__grid">
          <div class="edit-event__field edit-event__field--brief">
            <label
              class="edit-event__label"
              for="edit-brief"
            ><span class="edit-event__required">*</span>{{ t('create.brief') }}</label>
            <v-text-field
              id="edit-brief"
              v-model="name"
              :maxlength="BRIEF_MAX_LENGTH"
              :counter="BRIEF_MAX_LENGTH"
              :error="briefChanged && !briefIsValid"
              dir="auto"
              hide-details="auto"
            />
          </div>

          <div class="edit-event__field">
            <label
              class="edit-event__label"
              for="edit-platform"
            >{{ t('create.platform') }}</label>
            <v-select
              id="edit-platform"
              v-model="platforms"
              :items="platformItems"
              item-title="title"
              item-value="value"
              multiple
              chips
            />
          </div>

          <div
            v-if="asks('event_date')"
            class="edit-event__field"
          >
            <label
              class="edit-event__label"
              for="edit-date"
            >{{ t('create.eventDate') }}</label>
            <DateField
              id="edit-date"
              v-model="eventDate"
            />
          </div>

          <div
            v-if="asks('experiment_result')"
            class="edit-event__field"
          >
            <label
              class="edit-event__label"
              for="edit-result"
            >{{ t('create.result') }}</label>
            <v-select
              id="edit-result"
              v-model="experimentResult"
              :items="resultItems"
              item-title="title"
              item-value="value"
              clearable
            />
          </div>

          <div
            v-if="asks('notes')"
            class="edit-event__field edit-event__field--wide"
          >
            <label
              class="edit-event__label"
              for="edit-notes"
            >{{ t('create.information') }}</label>
            <v-textarea
              id="edit-notes"
              v-model="notes"
              rows="3"
              auto-grow
              dir="auto"
            />
          </div>
        </div>

        <!--
          Every edit joins the history of the event, and a history without reasons only says that somebody
          changed something. The reason is therefore asked for before the change can be saved.
        -->
        <div class="edit-event__field edit-event__field--wide">
          <label
            class="edit-event__label"
            for="edit-reason"
          ><span class="edit-event__required">*</span>{{ t('edit.reason') }}</label>
          <v-text-field
            id="edit-reason"
            v-model="reason"
            dir="auto"
          />
        </div>

        <!--
          The additional attributes of the event: the fields its industry declared and its type asks for,
          filled in here so that a value revealed after the upload has somewhere to go.
        -->
        <MetadataFieldsPanel
          v-if="eventFields.length > 0 || legacyCount > 0"
          :model-value="values"
          :types="valueTypes"
          :fields="eventFields"
          :title="t('detail.attributes')"
          @update:model-value="values = $event"
          @update:types="valueTypes = $event"
        />

        <div class="edit-event__files">
          <SectionHeader :title="t('files.label')" />
          <!--
            The files of an event used to be an add only list: a file uploaded by mistake, or one that was
            superseded, stayed on the event for good. Marking one here detaches it as part of this very edit,
            so the removal carries the same reason and lands in the history beside every other change.
          -->
          <StoredFilesEditor
            v-model="keptFiles"
            :stored="event.additional_files"
            :label="t('edit.attached')"
          />
          <FileDropzone
            :label="t('edit.addFiles')"
            :files="newFiles"
            @update:files="newFiles = $event"
          />
          <p
            v-if="duplicateWarning.length > 0"
            class="edit-event__duplicate"
          >
            {{ duplicateWarning }}
          </p>
        </div>
      </v-card-text>

      <v-card-actions class="edit-event__actions">
        <!--
          A button that is disabled without saying why reads as a broken button, so the reason it is waiting
          for is spelled out beside it.
        -->
        <span
          v-if="blockedReason.length > 0"
          class="edit-event__blocked"
        >
          {{ blockedReason }}
        </span>
        <!-- A pick large enough to be written part by part is a wait, so it is shown as one. -->
        <UploadProgress
          :visible="uploadVisible"
          :percent="uploadPercent"
          :label="uploadLabel"
        />
        <v-spacer />
        <v-btn
          variant="text"
          @click="attemptClose"
        >
          {{ t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="!canSave"
          @click="submit"
        >
          {{ t('common.save') }}
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
import UploadProgress from '@/components/UploadProgress.vue'
import {
  DateField,
  SectionHeader,
  UiDropzone as FileDropzone,
  UnsavedChangesDialog,
  localName,
  toDateInput,
  toIsoDate,
  valueLabel,
} from '@truth-platform/core-ui'
import { BRIEF_MAX_LENGTH, type EventDetail } from '@/models/event'
import type { FieldDefinition } from '@truth-platform/core-ui'
import type { Platform } from '@/models/platform'

interface Props {
  modelValue: boolean
  event: EventDetail
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void
  (event: 'saved', updated: EventDetail): void
}

/** One option of a picker, named in the language of the page. */
interface PickerItem<ValueT> {
  title: string
  value: ValueT
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import MetadataFieldsPanel from '@/components/MetadataFieldsPanel.vue'
import StoredFilesEditor from '@/components/StoredFilesEditor.vue'
import { useDirtyGuard } from '@truth-platform/core-ui'
import { useSnackbar } from '@truth-platform/core-ui'
import { useUploadProgress } from '@/composables/useUploadProgress'
import { updateEvent } from '@/requests/events'
import { listEventTypes, listFields, listPlatforms } from '@/requests/schema'
import { askedFieldKeys } from '@/utils/event-fields'
import { platformServes } from '@/utils/platforms'
import { discardRefusedUploads, uploadArtifacts } from '@/requests/storage'
import { collisionMessage } from '@/utils/artifacts'
import { toMetadataAttributes, toValueMap, toValueTypeMap, useLanguage } from '@truth-platform/core-ui'

const RESULT_OPTIONS: ExperimentResult[] = ['successful', 'partial', 'failed']

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { notify, reportError } = useSnackbar()
const { t, language } = useLanguage()

const name = ref<string>('')
const platforms = ref<string[]>([])
const experimentResult = ref<ExperimentResult | null>(null)
const eventDate = ref<string>('')
/*
 * The day the dialog opened on. The date input holds a day, while the event holds a moment - one a script may
 * have written at UTC midnight or at a time of day - so the date is sent only once it was changed. Sending the
 * day back on every save rewrote that moment to the reader's midnight and logged a date change nobody made.
 */
const openedDate = ref<string>('')
const notes = ref<string>('')
const platformOptions = ref<Platform[]>([])
const askedFields = ref<OptionalEventField[]>([])
const eventFields = ref<FieldDefinition[]>([])
const values = ref<Record<string, JsonValue>>({})
const valueTypes = ref<Record<string, FieldType>>({})
/* The stored files that will survive the edit, which starts out as every one of them. */
const keptFiles = ref<Artifact[]>([])
const newFiles = ref<File[]>([])
const reason = ref<string>('')
const saving = ref<boolean>(false)

/* How far the files of this edit have got, which only shows itself once a pick is large enough to wait for. */
const {
  track: trackUpload,
  reset: resetUpload,
  visible: uploadVisible,
  percent: uploadPercent,
  label: uploadLabel,
} = useUploadProgress()

/* What the dialog was filled with when it opened, which is what an edit is measured against. */
const openedWith = ref<string>('')

/**
 * Describe everything an edit can change as one comparable string.
 *
 * The reason is deliberately left out: it explains a change rather than being one, so typing a reason on its
 * own is not an edit. Files carry no value equality, so a picked file is described by what identifies it.
 */
const snapshot = (): string =>
  JSON.stringify({
    name: name.value,
    platforms: [...platforms.value],
    experimentResult: experimentResult.value,
    eventDate: eventDate.value,
    notes: notes.value,
    values: { ...values.value },
    keptFiles: keptFiles.value.map((file) => file.id),
    files: newFiles.value.map((file) => `${file.name}:${file.size}`),
  })

/*
 * Saving an event nobody changed used to be possible: it bumped the timestamp, mailed every subscriber and
 * left a line in the history for a change that never happened. The dialog now compares what it holds against
 * what it opened with, and the reason is asked for on top of a real change rather than instead of one.
 */
const isDirty = computed<boolean>(() => snapshot() !== openedWith.value)

/*
 * A picked file that the event already holds under the same name is refused rather than stored beside it:
 * two records nobody can tell apart help nobody, and only the person picking knows which one they meant.
 * Files marked for removal do not count, so replacing a file is take the old one off and add the new one.
 */
const duplicateWarning = computed<string>(() =>
  collisionMessage(keptFiles.value, newFiles.value, null, 'This event'),
)

/*
 * Values the event already holds under keys nothing declares. Nothing new can be written under such a key,
 * but what is already there has to stay visible, so the panel is opened for them even when this industry
 * has declared no event field at all.
 */
const legacyCount = computed<number>(() => {
  const declared = new Set(eventFields.value.map((field) => field.key))

  return Object.keys(values.value).filter((key) => !declared.has(key)).length
})

/*
 * A brief is only checked once it was touched: an event filed before briefs were held to fifty characters
 * may carry a longer one, and editing anything else about it must not force a new brief on it.
 */
const briefChanged = computed<boolean>(() => name.value.trim() !== props.event.name.trim())

const briefIsValid = computed<boolean>(() => {
  const written = name.value.trim()

  return written.length > 0 && written.length <= BRIEF_MAX_LENGTH
})

const platformItems = computed<PickerItem<string>[]>(() => {
  void language.value

  /* A platform the event already names stays offered, even one its industry is no longer linked to. */
  const offered = platformOptions.value.filter(
    (platform) => platformServes(platform, props.event.industry) || platforms.value.includes(platform.key),
  )

  return offered.map((platform) => ({ title: localName(platform), value: platform.key }))
})

const resultItems = computed<PickerItem<ExperimentResult>[]>(() => {
  void language.value

  return RESULT_OPTIONS.map((value) => ({ title: valueLabel(value), value }))
})

const blockedReason = computed<string>(() => {
  if (duplicateWarning.value.length > 0) {
    return t('edit.duplicateFiles')
  }

  if (briefChanged.value && !briefIsValid.value) {
    return t('edit.briefInvalid')
  }

  if (!isDirty.value) {
    return t('edit.nothingChanged')
  }

  if (reason.value.trim().length === 0) {
    return t('edit.reasonMissing')
  }

  return ''
})

const canSave = computed<boolean>(() => blockedReason.value.length === 0)

const asks = (field: OptionalEventField): boolean => askedFields.value.includes(field)

const fill = async (): Promise<void> => {
  name.value = props.event.name
  platforms.value = [...props.event.platforms]
  experimentResult.value = props.event.experiment_result
  eventDate.value = toDateInput(props.event.event_date)
  openedDate.value = eventDate.value
  notes.value = props.event.notes
  values.value = toValueMap(props.event.metadata)
  valueTypes.value = toValueTypeMap(props.event.metadata)
  keptFiles.value = [...props.event.additional_files]
  newFiles.value = []
  reason.value = ''

  try {
    const [declaredPlatforms, types, declaredFields] = await Promise.all([
      listPlatforms(props.event.industry),
      listEventTypes(props.event.industry),
      listFields({ scope: 'event', industry: props.event.industry }),
    ])
    platformOptions.value = declaredPlatforms
    /*
     * Which built in fields are on the form is decided by the types the event was filed under, so an event
     * of several types is asked for everything any one of them asks for.
     */
    const keys = new Set(props.event.event_type.map((reference) => reference.name))
    const filedUnder = types.filter((candidate) => keys.has(candidate.name))
    askedFields.value = [...new Set(filedUnder.flatMap((candidate) => candidate.fields))]
    /*
     * The declared fields follow the same rule as on the create form: only those a type of the event asks
     * for. One the event already holds a value for stays, so nothing written before is hidden from its editor.
     */
    const askedCustom = askedFieldKeys(filedUnder)
    eventFields.value = declaredFields.filter((field) => askedCustom.has(field.key) || field.key in values.value)
  } catch (error) {
    reportError(error)
  }

  openedWith.value = snapshot()
}

const close = () => {
  emit('update:modelValue', false)
}

/* Whatever was typed into the reason is worth keeping as well, so it counts towards leaving with changes. */
const { confirmOpen, attemptClose, discard } = useDirtyGuard({
  isDirty: () => isDirty.value || reason.value.trim().length > 0,
  close,
})

const submit = async (): Promise<void> => {
  if (!canSave.value || saving.value) {
    return
  }

  saving.value = true
  let uploaded: Artifact[] = []
  try {
    uploaded = await uploadArtifacts(newFiles.value, {
      ownerKind: 'events',
      ownerId: props.event.id,
      kind: 'additional',
      folder: null,
      descriptor: 'Files added after the event was created',
      onProgress: trackUpload(),
    })
    const updated = await updateEvent(props.event.id, {
      reason: reason.value.trim(),
      ...(briefChanged.value ? { name: name.value.trim() } : {}),
      platforms: [...platforms.value],
      experiment_result: experimentResult.value,
      ...(eventDate.value !== openedDate.value ? { event_date: toIsoDate(eventDate.value) } : {}),
      notes: notes.value,
      /* What survives the edit plus what was just added, which is how a removal reaches the service at all. */
      additional_files: [...keptFiles.value, ...uploaded],
      metadata: toMetadataAttributes(values.value, valueTypes.value),
    })
    notify(t('edit.saved'), 'success')
    emit('saved', updated)
    close()
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
  (open) => {
    if (open) {
      void fill()
    }
  },
)
</script>

<style scoped>
.edit-event {
  background-color: rgb(var(--v-theme-surface));
}

.edit-event__title {
  font-size: 1.25rem;
  font-weight: 600;
}

.edit-event__body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-block-size: 65vh;
}

.edit-event__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem;
}

.edit-event__field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-inline-size: 0;
}

.edit-event__field--wide {
  grid-column: 1 / -1;
}

.edit-event__field--brief {
  grid-column: span 2;
}

/*
 * A label that carries an information icon is taller than a plain one, which would start the control under it
 * lower than the control beside it. Reserving the icon's height for every label keeps the row aligned.
 */
.edit-event__label {
  font-size: 0.875rem;
  line-height: 1.5;
  min-block-size: 1.5rem;
}

.edit-event__required {
  color: rgb(var(--v-theme-error));
  margin-inline-end: 0.125rem;
}

.edit-event__section {
  font-size: 1rem;
  font-weight: 600;
  padding-block-end: 0.5rem;
}

.edit-event__actions {
  padding-inline: 1rem;
}

.edit-event__blocked {
  font-size: 0.8125rem;
  opacity: 0.7;
}

.edit-event__files {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.edit-event__duplicate {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-error));
}
</style>
