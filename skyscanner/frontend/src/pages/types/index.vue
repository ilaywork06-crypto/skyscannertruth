<template>
  <div class="sky-page">
    <AppHeader />

    <div class="sky-page__content settings">
      <div class="settings__heading">
        <h1 class="settings__title">
          {{ t('app.types') }}
        </h1>
        <v-btn-toggle
          v-model="kind"
          class="settings__toggle"
          mandatory
          divided
          density="compact"
        >
          <v-btn value="event">
            {{ t('types.event') }}
          </v-btn>
          <v-btn value="entity">
            {{ t('types.entity') }}
          </v-btn>
        </v-btn-toggle>
        <v-spacer />
        <v-select
          v-model="industry"
          class="settings__filter"
          :items="industryFilterItems"
          item-title="title"
          item-value="value"
          density="compact"
          hide-details
        />
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="openWith(null)"
        >
          {{ kind === 'event' ? t('types.newEvent') : t('types.newEntity') }}
        </v-btn>
      </div>

      <div
        class="settings__table"
        :dir="direction"
      >
        <v-table density="comfortable">
          <thead>
            <tr>
              <th v-if="kind === 'entity'" />
              <th
                v-for="side in nameSides"
                :key="side"
              >
                {{ t(`names.${side}`) }}
              </th>
              <th>{{ t('names.key') }}</th>
              <th>{{ t('app.industries') }}</th>
              <th v-if="kind === 'event'">
                {{ t('types.asksFor') }}
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="declared in types"
              :key="declared.id"
            >
              <td
                v-if="kind === 'entity'"
                class="settings__icon-cell"
              >
                <v-icon
                  v-if="declared.icon !== null && declared.icon.length > 0"
                  :icon="declared.icon"
                  size="20"
                />
              </td>
              <td
                v-for="side in nameSides"
                :key="side"
              >
                <!-- An event type is drawn as the tag it is shown as everywhere else, under its English name. -->
                <span
                  class="ui-name"
                  :dir="NAME_DIRECTIONS[side]"
                >
                  <UiChip
                    v-if="kind === 'event' && side === 'english'"
                    :label="splitNames(declared).english || EMPTY_PLACEHOLDER"
                    :token="hashedToken(declared.name)"
                  />
                  <template v-else>{{ splitNames(declared)[side] || EMPTY_PLACEHOLDER }}</template>
                </span>
              </td>
              <td>
                <code
                  class="ui-name"
                  dir="ltr"
                >{{ declared.key }}</code>
              </td>
              <td>
                <span class="settings__chips">
                  <UiChip
                    v-for="key in declared.industries"
                    :key="key"
                    :label="industryName(key)"
                    :icon="industryIcon(key)"
                    :token="NEUTRAL_TOKEN"
                  />
                  <span v-if="declared.industries.length === 0">{{ t('common.allIndustries') }}</span>
                </span>
              </td>
              <td v-if="kind === 'event'">
                {{ extraFieldsLabel(declared) }}
              </td>
              <td class="settings__row-actions">
                <v-btn
                  icon="mdi-pencil-outline"
                  size="small"
                  variant="text"
                  :aria-label="t('common.edit')"
                  :title="t('common.edit')"
                  @click="openWith(declared)"
                />
                <v-btn
                  icon="mdi-delete-outline"
                  size="small"
                  variant="text"
                  :aria-label="t('common.remove')"
                  :title="t('common.remove')"
                  @click="onDelete(declared.id)"
                />
              </td>
            </tr>
            <tr v-if="types.length === 0">
              <td
                colspan="7"
                class="settings__empty"
              >
                {{ EMPTY_PLACEHOLDER }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </div>

    <v-dialog
      :model-value="dialog"
      max-width="36rem"
      scrollable
      @update:model-value="attemptClose"
    >
      <v-card>
        <v-card-title>
          {{ edited === null ? (draftKind === 'event' ? t('types.newEventTitle') : t('types.newEntityTitle')) : t('types.edit') }}
        </v-card-title>
        <v-card-text class="settings__dialog">
          <NameFields
            :english="draftEnglish"
            :hebrew="draftHebrew"
            :show-errors="triedToSave"
            autofocus
            @update:english="onEnglishChange"
            @update:hebrew="draftHebrew = $event"
          />

          <!--
            The key is what every event filed under this type stores, so changing a stored one is a write
            across the inventory. It is unlocked on purpose, and what it would rewrite is shown first.
          -->
          <KeyField
            v-model="draftKey"
            :disabled="edited !== null && !renaming"
            :taken="takenKeys"
          >
            <template
              v-if="edited !== null && !renaming"
              #append
            >
              <v-btn
                size="x-small"
                variant="text"
                @click="startRename"
              >
                {{ t('rename.change') }}
              </v-btn>
            </template>
          </KeyField>

          <v-alert
            v-if="renamePreview !== null"
            type="warning"
            variant="tonal"
            density="compact"
          >
            {{ renameSummary }}
          </v-alert>

          <v-text-field
            v-model="draftDescription"
            :label="t('common.description')"
            dir="auto"
          />

          <v-select
            v-model="draftIndustries"
            :items="industryOptions"
            item-title="title"
            item-value="value"
            :label="t('app.industries')"
            :placeholder="t('common.allIndustries')"
            persistent-placeholder
            multiple
            chips
            closable-chips
          />

          <!-- Not every event is asked the same questions, so a type says which fields its form asks for. -->
          <template v-if="draftKind === 'event'">
            <v-select
              v-model="draftFields"
              :items="fieldItems"
              item-title="title"
              item-value="value"
              :label="t('types.builtInFields')"
              multiple
              chips
              closable-chips
            />
            <v-select
              v-model="draftCustomFields"
              :items="customFieldItems"
              item-title="title"
              item-value="value"
              :label="t('types.declaredFields')"
              :no-data-text="EMPTY_PLACEHOLDER"
              multiple
              chips
              closable-chips
            />
          </template>

          <IconPicker
            v-else
            v-model="draftIcon"
          />
        </v-card-text>
        <v-card-actions>
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
            @click="onSave"
          >
            {{ t('common.save') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <UnsavedChangesDialog
      v-model="confirmOpen"
      @discard="discard"
    />
  </div>
</template>

<script lang="ts">
import type { OptionalEventField } from '@/models/common'
import type { EntityType } from '@/models/entity'
import type { EventType } from '@/models/event'
import type { FieldDefinition, NameSide } from '@truth-platform/core-ui'
import type { RenameResult } from '@/requests/schema'

/** What this page declares: the shape an event takes, and the shape of the things nested inside one. */
type TypeKind = 'event' | 'entity'

interface Item<ValueT> {
  title: string
  value: ValueT
}

interface DeclaredType {
  id: string
  key: string
  name: string
  name_he: string
  description: string
  industries: string[]
  fields: OptionalEventField[]
  customFields: string[]
  icon: string | null
}

/* The built in event fields a type may switch on, which is the whole vocabulary the service understands. */
const OPTIONAL_FIELDS: OptionalEventField[] = ['event_date', 'experiment_result', 'notes']

/*
 * What a new event type asks for unless it is told otherwise: everything but the experiment result, which is
 * the one built in field that only makes sense on a type describing an experiment.
 */
const DEFAULT_FIELDS: OptionalEventField[] = ['event_date', 'notes']

const DEFAULT_ORDER = 100

/** What a new entity type is drawn with until another icon is picked. */
const DEFAULT_ICON = 'mdi-chart-timeline-variant'

const toDeclared = (declared: EventType | EntityType): DeclaredType => ({
  id: declared.id,
  key: declared.key,
  name: declared.name,
  name_he: declared.name_he ?? '',
  description: declared.description,
  industries: declared.industries,
  fields: 'fields' in declared ? declared.fields : [],
  customFields: 'custom_fields' in declared ? declared.custom_fields : [],
  icon: 'icon' in declared ? declared.icon : null,
})
</script>

<script setup lang="ts">
import {
  EMPTY_PLACEHOLDER,
  KeyField,
  NAME_DIRECTIONS,
  NEUTRAL_TOKEN,
  NameFields,
  UiChip,
  UnsavedChangesDialog,
  hasAName,
  hashedToken,
  isValidKey,
  joinIsolated,
  joinNames,
  localName,
  nameColumnOrder,
  splitNames,
  toKey,
  useDirtyGuard,
  useLanguage,
  useSnackbar,
} from '@truth-platform/core-ui'
import { computed, onMounted, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import IconPicker from '@/components/IconPicker.vue'
import { useIndustries } from '@/composables/useIndustries'
import { useRenameSummary } from '@/composables/useRenameSummary'
import {
  createEntityType,
  createEventType,
  deleteType,
  listEntityTypes,
  listEventTypes,
  listFields,
  previewTypeRename,
  updateEntityType,
  updateEventType,
} from '@/requests/schema'

const { t, language, direction } = useLanguage()
const { industries, findIndustry } = useIndustries()
const { notify, reportError } = useSnackbar()

const kind = ref<TypeKind>('event')
const industry = ref<string | null>(null)
const types = ref<DeclaredType[]>([])

/* The event fields declared on the Schema page, which an event type picks the ones it asks for out of. */
const eventFields = ref<FieldDefinition[]>([])

const dialog = ref<boolean>(false)
const saving = ref<boolean>(false)
const triedToSave = ref<boolean>(false)
const openedWith = ref<string>('')

/* The declaration being changed, or nothing while a new one is being written. */
const edited = ref<DeclaredType | null>(null)

const renaming = ref<boolean>(false)
const renamePreview = ref<RenameResult | null>(null)
const renameSummary = useRenameSummary(renamePreview)

const draftKind = ref<TypeKind>('event')
const draftEnglish = ref<string>('')
const draftHebrew = ref<string>('')
const draftKey = ref<string>('')
const draftDescription = ref<string>('')
const draftIndustries = ref<string[]>([])
const draftFields = ref<OptionalEventField[]>([...DEFAULT_FIELDS])
const draftCustomFields = ref<string[]>([])
const draftIcon = ref<string>(DEFAULT_ICON)

const nameSides = computed<NameSide[]>(() => nameColumnOrder())

const industryFilterItems = computed<Item<string | null>[]>(() => {
  void language.value

  return [
    { title: t('common.allIndustries'), value: null },
    ...industries.value.map((candidate) => ({ title: localName(candidate), value: candidate.key })),
  ]
})

const industryOptions = computed<Item<string>[]>(() => {
  void language.value

  return industries.value.map((candidate) => ({ title: localName(candidate), value: candidate.key }))
})

const fieldItems = computed<Item<OptionalEventField>[]>(() => {
  void language.value

  return OPTIONAL_FIELDS.map((value) => ({ title: t(`types.field.${value}`), value }))
})

const customFieldItems = computed<Item<string>[]>(() => {
  void language.value

  return eventFields.value.map((field) => ({ title: nameOfField(field.key), value: field.key }))
})

const industryName = (key: string): string => {
  const found = findIndustry(key)

  return found === undefined ? key : localName(found)
}

const industryIcon = (key: string): string => findIndustry(key)?.icon ?? ''

const takenKeys = computed<string[]>(() =>
  types.value.filter((declared) => declared.id !== edited.value?.id).map((declared) => declared.key),
)

const snapshot = (): string =>
  JSON.stringify([
    draftKind.value,
    draftEnglish.value,
    draftHebrew.value,
    draftKey.value,
    draftDescription.value,
    draftIndustries.value,
    draftFields.value,
    draftCustomFields.value,
    draftIcon.value,
  ])

const canSave = computed<boolean>(
  () =>
    hasAName({ english: draftEnglish.value, hebrew: draftHebrew.value })
    && isValidKey(draftKey.value)
    && !takenKeys.value.includes(draftKey.value.trim()),
)

const { confirmOpen, attemptClose, discard } = useDirtyGuard({
  isDirty: () => snapshot() !== openedWith.value,
  close: () => {
    dialog.value = false
  },
})

/** Read what a declared field is called, falling back to its key while the declarations are still loading. */
const nameOfField = (key: string): string => {
  const field = eventFields.value.find((candidate) => candidate.key === key)

  return field === undefined ? key : localName({ name: field.name, name_he: field.metadata.name_he })
}

/** Name the extra fields of a type, whether they were built in or declared on the Schema page. */
const extraFieldsLabel = (declared: DeclaredType): string => {
  const named = [
    ...declared.fields.map((field) => t(`types.field.${field}`)),
    ...declared.customFields.map(nameOfField),
  ]

  return named.length > 0 ? joinIsolated(named) : EMPTY_PLACEHOLDER
}

const load = async (): Promise<void> => {
  try {
    const [declared, fields] = await Promise.all([
      kind.value === 'event' ? listEventTypes(industry.value) : listEntityTypes(industry.value),
      listFields({ scope: 'event', industry: industry.value }),
    ])
    types.value = declared.map(toDeclared)
    eventFields.value = fields
  } catch (error) {
    reportError(error)
  }
}

/* The key follows the English name while a new type is written; a stored key never moves by itself. */
const onEnglishChange = (value: string) => {
  if (edited.value === null && draftKey.value === toKey(draftEnglish.value)) {
    draftKey.value = toKey(value)
  }
  draftEnglish.value = value
}

const openWith = (declared: DeclaredType | null) => {
  edited.value = declared
  renaming.value = false
  renamePreview.value = null
  triedToSave.value = false
  draftKind.value = kind.value
  const names = declared === null ? { english: '', hebrew: '' } : splitNames(declared)
  draftEnglish.value = names.english
  draftHebrew.value = names.hebrew
  draftKey.value = declared?.key ?? ''
  draftDescription.value = declared?.description ?? ''
  draftIndustries.value = [...(declared?.industries ?? [])]
  draftFields.value = declared === null ? [...DEFAULT_FIELDS] : [...declared.fields]
  draftCustomFields.value = [...(declared?.customFields ?? [])]
  draftIcon.value = declared?.icon ?? DEFAULT_ICON
  openedWith.value = snapshot()
  dialog.value = true
}

const startRename = async (): Promise<void> => {
  renaming.value = true
  const declared = edited.value
  if (declared === null) {
    return
  }

  try {
    renamePreview.value = await previewTypeRename(declared.id, declared.key)
  } catch (error) {
    reportError(error)
  }
}

const create = async (): Promise<void> => {
  const draft = {
    key: draftKey.value.trim(),
    ...joinNames({ english: draftEnglish.value, hebrew: draftHebrew.value }),
    description: draftDescription.value.trim(),
    industries: [...draftIndustries.value],
    order: DEFAULT_ORDER,
  }

  if (draftKind.value === 'event') {
    await createEventType({ ...draft, fields: [...draftFields.value], custom_fields: [...draftCustomFields.value] })

    return
  }

  await createEntityType({ ...draft, icon: draftIcon.value.length > 0 ? draftIcon.value : null })
}

const change = async (declared: DeclaredType): Promise<void> => {
  const moved = draftKey.value.trim() !== declared.key
  const draft = {
    key: moved ? draftKey.value.trim() : undefined,
    ...joinNames({ english: draftEnglish.value, hebrew: draftHebrew.value }),
    description: draftDescription.value.trim(),
    industries: [...draftIndustries.value],
  }

  if (draftKind.value === 'event') {
    await updateEventType(declared.id, {
      ...draft,
      fields: [...draftFields.value],
      custom_fields: [...draftCustomFields.value],
    })

    return
  }

  await updateEntityType(declared.id, { ...draft, icon: draftIcon.value.length > 0 ? draftIcon.value : null })
}

const onSave = async (): Promise<void> => {
  triedToSave.value = true
  if (!canSave.value) {
    return
  }

  saving.value = true
  try {
    const declared = edited.value
    if (declared === null) {
      await create()
      kind.value = draftKind.value
    } else {
      await change(declared)
    }

    notify(t('common.saved'), 'success')
    dialog.value = false
    await load()
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}

const onDelete = async (typeId: string): Promise<void> => {
  try {
    await deleteType(typeId)
    await load()
    notify(t('common.removed'), 'success')
  } catch (error) {
    reportError(error)
  }
}

onMounted(load)
watch([kind, industry], load)
</script>

<style scoped>
.settings__icon-cell {
  inline-size: 2.5rem;
}
</style>
