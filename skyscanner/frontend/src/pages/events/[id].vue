<template>
  <div class="sky-page">
    <AppHeader />

    <div
      v-if="event !== null"
      class="sky-page__content event-page"
      :class="{ 'event-page--rtl': isRtl }"
    >
      <div class="event-page__heading">
        <span class="event-page__badge">{{ t('event.badge') }}</span>
        <div class="event-page__heading-row">
          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            :aria-label="t('event.back')"
            @click="goBack"
          />
          <!--
            The brief somebody wrote for the event is its title; the line worked out from what the event says
            about itself - its type, platform, industry and date - reads underneath.
          -->
          <div class="event-page__names">
            <h1
              class="event-page__title"
              dir="auto"
            >
              <UiLinkedText :text="event.name" />
            </h1>
            <p
              class="event-page__brief"
              dir="auto"
            >
              {{ title }}
            </p>
          </div>
          <v-spacer />
          <v-btn
            icon="mdi-history"
            variant="tonal"
            :aria-label="t('event.history')"
            :title="t('event.history')"
            @click="historyDialog = true"
          />
          <!-- The bell follows the same flag as the rest of the feature, so it appears again with it. -->
          <v-btn
            v-if="SUBSCRIPTIONS_ENABLED"
            icon="mdi-bell-outline"
            color="secondary"
            :aria-label="t('event.follow')"
            @click="subscribeDialog = true"
          />
          <v-btn
            icon="mdi-delete"
            color="error"
            :aria-label="t('event.delete')"
            :title="t('event.delete')"
            @click="deleteDialog = true"
          />
          <v-btn
            icon="mdi-pencil"
            color="primary"
            :aria-label="t('event.edit')"
            :title="t('event.edit')"
            @click="editDialog = true"
          />
        </div>
      </div>

      <section class="event-page__facts">
        <div class="event-page__fact">
          <span class="event-page__fact-label">{{ t('event.id') }}</span>
          <span class="event-page__fact-value event-page__fact-value--number">{{ event.event_id }}</span>
        </div>
        <div class="event-page__fact">
          <span class="event-page__fact-label">{{ t('event.type') }}</span>
          <span class="event-page__fact-chips">
            <UiChip
              v-for="type in event.event_type"
              :key="type.id"
              :label="typeName(type.name)"
              :token="hashedToken(type.name)"
            />
          </span>
        </div>
        <div class="event-page__fact">
          <span class="event-page__fact-label">{{ t('event.date') }}</span>
          <span class="event-page__fact-value">
            <v-icon
              size="x-small"
              icon="mdi-calendar-blank-outline"
            />
            {{ formatDate(event.event_date) }}
          </span>
        </div>
        <div class="event-page__fact">
          <span class="event-page__fact-label">{{ t('event.industry') }}</span>
          <UiChip
            :label="industryName"
            :token="NEUTRAL_TOKEN"
            :icon="industryIcon"
          />
        </div>
        <!-- An event may have run on several platforms, so every one of them is named rather than the first. -->
        <div
          v-if="event.platforms.length > 0"
          class="event-page__fact"
        >
          <span class="event-page__fact-label">{{ t('event.platform') }}</span>
          <span class="event-page__fact-chips">
            <UiChip
              v-for="platform in event.platforms"
              :key="platform"
              :label="platformName(platform)"
              :token="NEUTRAL_TOKEN"
            />
          </span>
        </div>
        <div
          v-if="event.experiment_result !== null"
          class="event-page__fact"
        >
          <span class="event-page__fact-label">{{ t('event.result') }}</span>
          <UiChip
            :label="valueLabel(event.experiment_result)"
            :token="NEUTRAL_TOKEN"
          />
        </div>
        <div class="event-page__fact event-page__fact--stamp">
          <span class="event-page__fact-label">{{ t('event.createdAt') }}</span>
          <span class="event-page__fact-value">{{ formatDateTime(event.created_at) }}</span>
        </div>
        <div class="event-page__fact event-page__fact--stamp">
          <span class="event-page__fact-label">{{ t('event.updatedAt') }}</span>
          <span class="event-page__fact-value">{{ formatDateTime(event.updated_at) }}</span>
        </div>
      </section>

      <section
        v-if="event.notes.trim().length > 0"
        class="event-page__information"
      >
        <span class="event-page__fact-label">{{ t('event.information') }}</span>
        <!--
          The information of an event is free text. The breaks somebody typed into it are part of what they
          wrote, so the paragraph keeps them, and the addresses inside it are read out as links.
        -->
        <p
          class="event-page__notes"
          dir="auto"
        >
          <UiLinkedText :text="event.notes" />
        </p>
      </section>

      <!--
        Everything the event was written with beyond the facts above - the fields its industry declared, the
        ones its type asks for and anything a script left on it. The expanded row of the inventory has shown
        these all along; the page of the event itself showed the built in facts and stopped, so the one
        surface dedicated to a single event was the one place its own answers could not be read.
      -->
      <section
        v-if="eventAttributeColumns.length > 0"
        class="event-page__attributes"
      >
        <AttributesTable
          :columns="eventAttributeColumns"
          :row="eventRow"
          :taxonomy="taxonomy"
          :token-for="paletteToken"
          :title="t('detail.attributes')"
          :empty-text="EMPTY_PLACEHOLDER"
          @open="onPreview"
          @download="onDownload"
        />
      </section>

      <section class="event-page__files">
        <SectionHeader
          :title="t('event.files')"
          :count="fileCount"
        >
          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-folder-zip-outline"
            :loading="archiving"
            @click="onDownloadArchive"
          >
            {{ t('event.downloadAll') }}
          </v-btn>
        </SectionHeader>
        <div class="event-page__files-body">
          <aside class="event-page__file-tree">
            <EventFileTree
              :additional-files="event.additional_files"
              :entities="event.objects"
              :active-id="selectedArtifact?.id ?? null"
              @open="onPreview"
              @download="onDownload"
            />
          </aside>
          <!--
            Picking a file shows it here rather than handing it to the browser, which is what the shared
            preview is for: it decides per file whether that means a picture, a frame, a sheet or a text.
          -->
          <div class="event-page__preview">
            <template v-if="selectedArtifact !== null">
              <v-btn
                class="event-page__preview-download"
                icon="mdi-download"
                variant="text"
                :aria-label="t('files.download')"
                :title="t('files.download')"
                @click="onDownload(selectedArtifact)"
              />
              <FilePreview
                class="event-page__preview-file"
                :artifact="selectedArtifact"
                @download="onDownload"
              />
            </template>
            <v-icon
              v-else
              class="event-page__preview-empty"
              icon="mdi-file-eye-outline"
              size="40"
            />
          </div>
        </div>
      </section>

      <section class="event-page__entities">
        <div class="event-page__tabs">
          <button
            v-for="group in entityGroups"
            :key="group.key"
            type="button"
            class="event-page__tab"
            :class="{ 'event-page__tab--active': activeTab === group.key }"
            @click="activeTab = group.key"
          >
            <span dir="auto">{{ group.name }}</span>
            <span class="event-page__tab-count">{{ group.rows.length }}</span>
          </button>
          <v-spacer />
          <v-btn
            class="event-page__add"
            variant="tonal"
            color="primary"
            size="small"
            prepend-icon="mdi-plus"
            @click="openAddEntity"
          >
            {{ t('detail.addEntity') }}
          </v-btn>
        </div>

        <EntityTable
          :rows="activeRows"
          :columns="entityColumns"
          :industries="taxonomy"
          :downloading="entityArchiving"
          @open="onPreview"
          @download="onDownload"
          @edit="openEditEntity"
          @download-entities="onDownloadEntities"
        />
      </section>

      <EditEventDialog
        v-model="editDialog"
        :event="event"
        @saved="onSaved"
      />
      <!-- The same dialog attaches a new entity and changes one that is already there. -->
      <AddEntityDialog
        v-model="entityDialog"
        :event="event"
        :entity="editedEntity"
        @added="onEntitySaved"
      />
      <SubscribeDialog
        v-if="SUBSCRIPTIONS_ENABLED"
        v-model="subscribeDialog"
        :event-id="event.id"
        :target-label="event.name"
      />
      <RevisionHistoryDialog
        v-model="historyDialog"
        :event-id="event.id"
        :title="t('event.historyOf', { name: event.name })"
      />

      <v-dialog
        v-model="deleteDialog"
        max-width="26rem"
      >
        <v-card>
          <v-card-title>{{ t('event.deleteTitle') }}</v-card-title>
          <v-card-text>{{ t('event.deleteBody') }}</v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              variant="text"
              @click="deleteDialog = false"
            >
              {{ t('common.cancel') }}
            </v-btn>
            <v-btn
              color="error"
              @click="onDelete"
            >
              {{ t('event.delete') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>

    <div
      v-else
      class="event-page__loading"
    >
      <v-progress-circular
        indeterminate
        color="primary"
        size="40"
      />
    </div>
  </div>
</template>

<script lang="ts">
import type { Artifact, JsonValue } from '@/models/common'
import {
  EMPTY_PLACEHOLDER,
  NEUTRAL_TOKEN,
  SectionHeader,
  UiChip,
  formatDate,
  formatDateTime,
  hashedToken,
  localName,
  localiseColumns,
  useLanguage,
  valueLabel,
  type TaxonomyItem,
} from '@truth-platform/core-ui'
import type { EntityResponse } from '@/models/entity'
import type { EventDetail, EventType } from '@/models/event'
import type { GeneratedColumn, GridRow } from '@/models/grid'
import type { Platform } from '@/models/platform'

interface EntityGroup {
  key: string
  name: string
  rows: GridRow[]
}
</script>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AddEntityDialog from '@/components/AddEntityDialog.vue'
import AppHeader from '@/components/AppHeader.vue'
import EditEventDialog from '@/components/EditEventDialog.vue'
import EntityTable from '@/components/EntityTable.vue'
import EventFileTree from '@/components/EventFileTree.vue'
import FilePreview from '@/components/FilePreview.vue'
import RevisionHistoryDialog from '@/components/RevisionHistoryDialog.vue'
import { AttributesTable, UiLinkedText } from '@truth-platform/core-ui'
import SubscribeDialog from '@/components/SubscribeDialog.vue'
import { useSnackbar } from '@truth-platform/core-ui'
import { useIndustries } from '@/composables/useIndustries'
import { SUBSCRIPTIONS_ENABLED } from '@/features'
import { deleteEvent, readEvent } from '@/requests/events'
import { readEntityColumns, readEventColumns } from '@/requests/grid'
import { downloadArtifact, downloadEntityArchive, toArchiveSources } from '@/requests/storage'
import { downloadEventFiles } from '@/requests/templates'
import { downloadBlob } from '@truth-platform/core-ui'
import { attributeColumns } from '@truth-platform/core-ui'
import { listEventTypes, listPlatforms } from '@/requests/schema'
import { buildEventTitle } from '@/utils/brief'
import { paletteToken } from '@/utils/colors'
import { askedFieldKeys, eventAttributeColumnsFor } from '@/utils/event-fields'
import { entityToRow, eventToRow } from '@/utils/rows'

const route = useRoute('/events/[id]')
const router = useRouter()
const { industries, findIndustry } = useIndustries()
const { notify, reportError } = useSnackbar()
const { t, language, isRtl } = useLanguage()

/* The declarations the event names by key or by stored name, read so the page can name them in its language. */
const eventTypes = ref<EventType[]>([])
const platforms = ref<Platform[]>([])

const event = ref<EventDetail | null>(null)
const entityColumns = ref<GeneratedColumn[]>([])
const eventColumns = ref<GeneratedColumn[]>([])
const activeTab = ref<string>('')
const selectedArtifact = ref<Artifact | null>(null)
const editDialog = ref<boolean>(false)
const deleteDialog = ref<boolean>(false)
const entityDialog = ref<boolean>(false)
const subscribeDialog = ref<boolean>(false)
const historyDialog = ref<boolean>(false)
const archiving = ref<boolean>(false)
const entityArchiving = ref<boolean>(false)
const editedEntity = ref<EntityResponse | null>(null)

const eventId = computed<string>(() => route.params.id)

const taxonomy = computed<TaxonomyItem[]>(() =>
  industries.value.map((industry) => ({
    key: industry.key,
    name: industry.name,
    name_he: industry.name_he,
    icon: industry.icon,
    color: '',
  })),
)

/** What a type the event was filed under is called in the language of the page. */
const typeName = (stored: string): string => {
  void language.value
  const declared = eventTypes.value.find((type) => type.name === stored)

  return declared === undefined ? stored : localName(declared)
}

/** What a platform the event ran on is called in the language of the page. */
const platformName = (key: string): string => {
  void language.value
  const declared = platforms.value.find((platform) => platform.key === key)

  return declared === undefined ? key : localName(declared)
}

const industryName = computed<string>(() => {
  void language.value
  const current = event.value
  if (current === null) {
    return ''
  }

  const industry = findIndustry(current.industry)

  return industry === undefined ? current.industry : localName(industry)
})

const industryIcon = computed<string>(() => {
  const current = event.value

  return current === null ? '' : (findIndustry(current.industry)?.icon ?? 'mdi-domain')
})

/* The head of the page: what happened, where and when, in the words of the page. */
const title = computed<string>(() => {
  const current = event.value
  if (current === null) {
    return ''
  }

  return buildEventTitle({
    typeNames: current.event_type.map((type) => typeName(type.name)),
    platformNames: current.platforms.map(platformName),
    industryName: industryName.value,
    day: formatDate(current.event_date ?? current.created_at),
  })
})

/* How many files the event holds, its own and those of every entity in it. */
const fileCount = computed<number>(() => {
  const current = event.value
  if (current === null) {
    return 0
  }

  return current.objects.reduce(
    (total, entity) =>
      total + entity.raw_files.length + entity.parsed_files.length + entity.parsed_additional_files.length,
    current.additional_files.length,
  )
})

/* The event flattened the way the generated columns address it, which is the shape the inventory hands them. */
const eventRow = computed<GridRow>(() => (event.value === null ? { id: '' } : eventToRow(event.value)))

/*
 * The declared dynamic fields of this industry, followed by whatever the event carries under a key nobody
 * declared - the same reading the expanded row of the inventory does, through the same helper.
 */
const eventAttributeColumns = computed<GeneratedColumn[]>(() => {
  /* A declared field only belongs to the events whose types ask for it. */
  const filedUnder = new Set((event.value?.event_type ?? []).map((reference) => reference.name))
  const asked = askedFieldKeys(eventTypes.value.filter((candidate) => filedUnder.has(candidate.name)))

  return eventAttributeColumnsFor(
    attributeColumns(eventColumns.value, eventRow.value),
    asked,
    eventRow.value.data as Record<string, JsonValue> | undefined,
  )
})

const entityGroups = computed<EntityGroup[]>(() => {
  if (event.value === null) {
    return []
  }

  const groups = new Map<string, EntityGroup>()
  event.value.objects.forEach((entity) => {
    const key = entity.object_type.name
    const group = groups.get(key) ?? { key, name: entityTypeName(key), rows: [] }
    group.rows.push(entityToRow(entity))
    groups.set(key, group)
  })

  return [...groups.values()]
})

/** What an entity type is called in the language of the page, read off the vocabulary of its column. */
const entityTypeName = (stored: string): string => {
  void language.value
  const option = entityColumns.value
    .find((column) => column.colId === 'object_type_name')
    ?.filterOptions.find((candidate) => candidate.value === stored)

  return option === undefined ? stored : localName({ name: option.label, name_he: option.labelHebrew })
}

const activeRows = computed<GridRow[]>(
  () => entityGroups.value.find((group) => group.key === activeTab.value)?.rows ?? [],
)

const reload = async (): Promise<void> => {
  try {
    const loaded = await readEvent(eventId.value)
    event.value = loaded
    const [entities, events, types, declaredPlatforms] = await Promise.all([
      readEntityColumns(loaded.industry, null),
      readEventColumns(loaded.industry),
      listEventTypes(null),
      listPlatforms(null),
    ])
    entityColumns.value = localiseColumns(entities).columns
    eventColumns.value = localiseColumns(events).columns
    eventTypes.value = types
    platforms.value = declaredPlatforms
    if (activeTab.value.length === 0 || !entityGroups.value.some((group) => group.key === activeTab.value)) {
      activeTab.value = entityGroups.value[0]?.key ?? ''
    }
  } catch (error) {
    reportError(error)
  }
}

const goBack = () => {
  void router.push('/events')
}

/**
 * Show a file in the preview pane. Opening a file and downloading it are separate actions, so picking one
 * here never puts a copy of it on the disk of the user.
 */
const onPreview = (artifact: Artifact) => {
  selectedArtifact.value = artifact
}

const onDownload = (artifact: Artifact) => {
  downloadArtifact(artifact)
}

/**
 * Download every file of this event as one archive, laid out in the same folders the tree shows.
 */
const onDownloadArchive = async (): Promise<void> => {
  const current = event.value
  if (current === null) {
    return
  }

  archiving.value = true
  try {
    const archive = await downloadEventFiles({
      search: null,
      industry: current.industry,
      industries: [],
      parse_state: 'all',
      filters: [],
      sort: [],
      page: 1,
      page_size: 1,
      columns: [],
      event_ids: [current.id],
    })
    downloadBlob(archive.blob, archive.name)
    notify(t('inventory.packed'), 'success')
  } catch (error) {
    reportError(error)
  } finally {
    archiving.value = false
  }
}

const openAddEntity = () => {
  editedEntity.value = null
  entityDialog.value = true
}

/**
 * Open the entity dialog on one of the entities of this event, which switches it into its edit mode.
 */
const openEditEntity = (entityId: string) => {
  const entity = event.value?.objects.find((candidate) => candidate.id === entityId)
  if (entity === undefined) {
    return
  }

  editedEntity.value = entity
  entityDialog.value = true
}

const onEntitySaved = async (): Promise<void> => {
  editedEntity.value = null
  await reload()
}

/**
 * Download the files of the picked entities as one archive named after this event.
 */
const onDownloadEntities = async (entityIds: string[]): Promise<void> => {
  const current = event.value
  if (current === null || entityArchiving.value) {
    return
  }

  const picked = current.objects.filter((entity) => entityIds.includes(entity.id))
  if (picked.length === 0) {
    return
  }

  entityArchiving.value = true
  try {
    await downloadEntityArchive(String(current.event_id), current.name, toArchiveSources(picked))
    notify(t('inventory.packed'), 'success')
  } catch (error) {
    reportError(error)
  } finally {
    entityArchiving.value = false
  }
}

const onSaved = (updated: EventDetail) => {
  event.value = updated
}

const onDelete = async (): Promise<void> => {
  if (event.value === null) {
    return
  }

  try {
    await deleteEvent(event.value.id)
    notify(t('event.deleted'), 'success')
    void router.push('/events')
  } catch (error) {
    reportError(error)
  } finally {
    deleteDialog.value = false
  }
}

onMounted(reload)
watch(eventId, reload)

/* The entity tables are named in the language of the page, which is a reading of their columns. */
watch(language, () => {
  void reload()
})
</script>

<style scoped>
.event-page {
  gap: 1.25rem;
}

.event-page__heading {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-block-start: 1rem;
}

.event-page__badge {
  align-self: flex-start;
  margin-inline-start: 2.5rem;
  background-color: rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 0.375rem;
  padding-inline: 0.625rem;
  padding-block: 0.125rem;
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
}

.event-page__heading-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.event-page__names {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-inline-size: 0;
}

.event-page__title {
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.2;
}

.event-page__brief {
  font-size: 1rem;
  opacity: 0.8;
}

.event-page__facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2rem;
  background-color: rgb(var(--v-theme-surface));
  border-radius: 0.5rem;
  padding: 1rem 1.5rem;
}

.event-page__fact {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-inline-size: 0;
}

/* Several platforms wrap inside the one fact rather than each of them becoming a fact of its own. */
.event-page__fact-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.event-page__fact-label {
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  opacity: 0.7;
  unicode-bidi: plaintext;
  text-align: start;
}

/*
 * A Hebrew page reads each fact from the right: its label and its value stand at the right edge of the fact,
 * and the label of the information stands over the right end of the text. The facts keep their places.
 */
.event-page--rtl .event-page__fact {
  align-items: flex-end;
}

.event-page--rtl .event-page__information > .event-page__fact-label {
  align-self: flex-end;
}

.event-page__fact-value {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.9375rem;
}

.event-page__fact-value--number {
  font-variant-numeric: tabular-nums;
}

/* The two moments the system recorded close the row, one step quieter than the facts before them. */
.event-page__fact--stamp {
  opacity: 0.8;
}

.event-page__fact:not(.event-page__fact--stamp) + .event-page__fact--stamp {
  margin-inline-start: auto;
}

.event-page__information {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  background-color: rgb(var(--v-theme-surface));
  border-radius: 0.5rem;
  padding: 1rem 1.5rem;
}

/*
 * Every break the user typed is kept: the information of an event is written in paragraphs often enough that
 * collapsing it the way a browser collapses ordinary text would read it back as one run on line.
 */
.event-page__notes {
  font-size: 0.9375rem;
  white-space: pre-wrap;
}

.event-page__notes--empty {
  opacity: 0.7;
}

/* The attributes sit in a panel of their own, laid out like the information block above them. */
.event-page__attributes {
  background-color: rgb(var(--v-theme-surface));
  border-radius: 0.5rem;
  padding: 1rem 1.5rem;
  min-inline-size: 0;
}

.event-page__files {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.event-page__files-body {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) minmax(0, 3fr);
  gap: 0.75rem;
  min-block-size: 18rem;
}

/*
 * Both panes scroll inside themselves rather than growing: an event of a hundred files and a sheet of five
 * hundred rows would otherwise push the entities of the event off the bottom of the page.
 */
.event-page__file-tree,
.event-page__preview {
  max-block-size: 32rem;
}

.event-page__file-tree {
  background-color: rgb(var(--v-theme-surface));
  border-radius: 0.5rem;
  padding: 1rem;
  overflow: auto;
}

/*
 * The pane holds whatever the preview decided to render, so it carries the ordinary surface behind it: a
 * sheet and a log are read here as often as a picture is looked at, and neither reads well on a dark ground.
 */
.event-page__preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgb(var(--v-theme-surface));
  border-radius: 0.5rem;
  padding: 0.75rem;
  min-block-size: 18rem;
  overflow: hidden;
}

/* The download control floats over whatever the preview shows, so it carries a ground of its own. */
.event-page__preview-download.v-btn {
  position: absolute;
  inset-block-start: 1.25rem;
  inset-inline-end: 1.25rem;
  z-index: 2;
  background-color: rgb(var(--v-theme-surface));
  box-shadow: 0 0.125rem 0.5rem rgba(0, 0, 0, 0.25);
}

.event-page__preview-file {
  align-self: stretch;
  min-inline-size: 0;
}

/* The toolbar of a sheet ends before the download control above it rather than underneath it. */
.event-page__preview :deep(.file-preview__toolbar) {
  padding-inline-end: 2.5rem;
}

.event-page__preview-empty {
  opacity: 0.35;
}

.event-page__entities {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

/* The entity types stand as folder tabs on the edge of the table, as the design draws them. */
.event-page__tabs {
  display: flex;
  align-items: flex-end;
  gap: 0.375rem;
  border-block-end: 0.0625rem solid rgba(var(--v-theme-on-surface), 0.35);
}

.event-page__tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 0.0625rem solid rgba(var(--v-theme-on-surface), 0.35);
  border-block-end: none;
  border-radius: 0.5rem 0.5rem 0 0;
  background-color: transparent;
  color: inherit;
  font: inherit;
  padding-inline: 1.25rem;
  padding-block: 0.4375rem;
  cursor: pointer;
}

.event-page__tab-count {
  min-inline-size: 1.375rem;
  padding-inline: 0.375rem;
  border-radius: 999px;
  background-color: rgba(var(--v-theme-on-surface), 0.12);
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.375rem;
  text-align: center;
}

.event-page__tab--active {
  background-color: rgb(var(--v-theme-tab-active));
  border-color: transparent;
  color: rgb(var(--v-theme-on-tab-active));
  font-weight: 700;
}

.event-page__tab--active .event-page__tab-count {
  background-color: rgba(var(--v-theme-on-tab-active), 0.14);
}

.event-page__add.v-btn {
  margin-block-end: 0.375rem;
  letter-spacing: normal;
}

.event-page__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  min-block-size: 60vh;
}

@media (max-width: 60rem) {
  .event-page__files-body {
    grid-template-columns: 1fr;
  }
}
</style>
