<template>
  <div class="sky-page">
    <AppHeader />

    <div class="sky-page__content settings">
      <div class="settings__heading">
        <h1 class="settings__title">
          {{ t('app.schema') }}
        </h1>
        <v-btn-toggle
          v-model="section"
          class="settings__toggle"
          mandatory
          divided
          density="compact"
        >
          <v-btn
            v-for="item in sectionItems"
            :key="item.value"
            :value="item.value"
          >
            {{ item.title }}
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
          @click="openCreate"
        >
          {{ t('schema.new') }}
        </v-btn>
      </div>

      <div
        class="settings__table"
        :dir="direction"
      >
        <v-table density="comfortable">
          <thead>
            <tr>
              <th
                v-for="side in nameSides"
                :key="side"
              >
                {{ t(`names.${side}`) }}
              </th>
              <th>{{ t('names.key') }}</th>
              <th>{{ t('schema.type') }}</th>
              <th>{{ t('schema.industry') }}</th>
              <th v-if="isEventScope">
                {{ t('schema.eventTypes') }}
              </th>
              <th v-else>
                {{ t('schema.entityType') }}
              </th>
              <th>{{ t('schema.required') }}</th>
              <th>{{ t('schema.visible') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="field in fields"
              :key="field.id"
            >
              <td
                v-for="side in nameSides"
                :key="side"
              >
                <span
                  class="ui-name"
                  :dir="NAME_DIRECTIONS[side]"
                >{{ fieldNames(field)[side] || EMPTY_PLACEHOLDER }}</span>
              </td>
              <td>
                <code
                  class="ui-name"
                  dir="ltr"
                >{{ field.key }}</code>
              </td>
              <td>
                <span class="schema__type">{{ typeLabel(field.type) }}{{ field.array ? '[]' : '' }}</span>
              </td>
              <td>
                <UiChip
                  v-if="field.industry !== null"
                  :label="industryName(field.industry)"
                  :icon="industryIcon(field.industry)"
                  :token="NEUTRAL_TOKEN"
                />
                <span v-else>{{ t('common.allIndustries') }}</span>
              </td>
              <td v-if="isEventScope">
                {{ eventTypeNames(field.key) || EMPTY_PLACEHOLDER }}
              </td>
              <td v-else>
                {{ field.entity_type === null ? t('schema.everyEntityType') : entityTypeName(field.entity_type) }}
              </td>
              <td>
                <v-icon
                  v-if="field.required"
                  size="18"
                  icon="mdi-check"
                />
              </td>
              <td>
                <v-icon
                  v-if="field.visible"
                  size="18"
                  icon="mdi-check"
                />
              </td>
              <td class="settings__row-actions">
                <v-btn
                  icon="mdi-pencil-outline"
                  size="small"
                  variant="text"
                  :aria-label="t('common.edit')"
                  :title="t('common.edit')"
                  @click="openEdit(field)"
                />
                <v-btn
                  icon="mdi-delete-outline"
                  size="small"
                  variant="text"
                  :aria-label="t('common.remove')"
                  :title="t('common.remove')"
                  @click="onDelete(field.id)"
                />
              </td>
            </tr>
            <tr v-if="fields.length === 0">
              <td
                colspan="9"
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
      max-width="40rem"
      scrollable
      @update:model-value="attemptClose"
    >
      <v-card>
        <v-card-title>{{ edited === null ? t('schema.newTitle') : t('schema.edit') }}</v-card-title>
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
            The key is where every value answering this field is stored, so changing a stored one moves every
            value ever written under it. It is unlocked on purpose, and what it would move is shown first.
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

          <div class="schema__pair">
            <v-select
              v-model="draftType"
              :items="typeItems"
              item-title="title"
              item-value="value"
              :label="t('schema.type')"
            />
            <v-select
              v-model="draftSection"
              :items="sectionItems"
              item-title="title"
              item-value="value"
              :label="t('schema.section')"
            />
          </div>

          <!-- A field of an entity belongs to one kind of entity, or to all of them. -->
          <v-select
            v-if="!draftIsEventScope"
            v-model="draftEntityType"
            :items="entityTypeItems"
            item-title="title"
            item-value="value"
            :label="t('schema.entityType')"
          />

          <!-- An event field is asked for by the event types that name it, and shown on their events only. -->
          <v-select
            v-if="draftIsEventScope"
            v-model="draftEventTypes"
            :items="eventTypeItems"
            item-title="title"
            item-value="value"
            :label="t('schema.eventTypes')"
            :no-data-text="EMPTY_PLACEHOLDER"
            :error="triedToSave && draftEventTypes.length === 0"
            multiple
            chips
            closable-chips
          >
            <template
              v-if="eventTypeItems.length > 1"
              #prepend-item
            >
              <v-list-item
                :title="t('filters.selectAll')"
                @click="toggleAllEventTypes"
              >
                <template #prepend>
                  <v-checkbox-btn
                    :model-value="allEventTypesChosen"
                    :indeterminate="draftEventTypes.length > 0 && !allEventTypesChosen"
                  />
                </template>
              </v-list-item>
              <v-divider />
            </template>
          </v-select>

          <!--
            An entity type already belongs to its industries, so the industry is only asked where there is
            nothing to read it off.
          -->
          <v-select
            v-if="industryIsAsked"
            v-model="draftIndustry"
            :items="industryItems"
            item-title="title"
            item-value="value"
            :label="t('schema.industry')"
          />

          <v-combobox
            v-if="draftType === 'enum'"
            v-model="draftOptions"
            :label="t('schema.options')"
            :hint="t('input.pressEnter')"
            persistent-hint
            multiple
            chips
            closable-chips
          />
          <v-textarea
            v-model="draftDescription"
            :label="t('common.description')"
            rows="2"
            auto-grow
            dir="auto"
          />

          <!--
            A field may apply only once another field of the same entity form holds a value. An event field has
            no such form to point into, so it is not offered conditions.
          -->
          <div
            v-if="!draftIsEventScope"
            class="schema__dependencies"
          >
            <SectionHeader :title="t('schema.dependsOn')">
              <v-btn
                size="small"
                variant="text"
                prepend-icon="mdi-plus"
                :disabled="dependencyCandidates.length === 0"
                @click="addDependency"
              >
                {{ t('schema.addCondition') }}
              </v-btn>
            </SectionHeader>
            <div
              v-for="(dependency, index) in draftDependencies"
              :key="index"
              class="schema__dependency"
            >
              <v-select
                v-model="dependency.field"
                :items="dependencyCandidates"
                item-title="title"
                item-value="value"
                :label="t('schema.conditionField')"
                density="compact"
              />
              <v-select
                v-model="dependency.operator"
                :items="operatorItems"
                item-title="title"
                item-value="value"
                :label="t('schema.condition')"
                density="compact"
              />
              <v-combobox
                v-if="dependency.operator !== 'has_value' && dependency.operator !== 'is_empty'"
                v-model="dependency.values"
                :label="t('fieldFilter.values')"
                density="compact"
                multiple
                chips
                closable-chips
              />
              <v-btn
                icon="mdi-close"
                size="x-small"
                variant="text"
                :aria-label="t('common.remove')"
                @click="removeDependency(index)"
              />
            </div>
          </div>

          <div class="schema__flags">
            <!-- A field of any listable type may hold a list of such values instead of a single one. -->
            <v-checkbox
              v-model="draftArray"
              :label="t('schema.multiple')"
              :disabled="!canBeList"
              hide-details
            />
            <v-checkbox
              v-model="draftRequired"
              :label="t('schema.required')"
              hide-details
            />
            <v-checkbox
              v-model="draftVisible"
              :label="t('schema.shownByDefault')"
              hide-details
            />
          </div>
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
import type { FieldType } from '@/models/common'
import type { EntityType } from '@/models/entity'
import type { EventType } from '@/models/event'
import type {
  DependencyOperator,
  FieldDefinition,
  FieldDependency,
  NamePair,
  NameSide,
} from '@truth-platform/core-ui'
import type { RenameResult } from '@/requests/schema'

interface SelectItem {
  title: string
  value: string | null
}

/**
 * What the page is showing.
 *
 * The two halves of the entity form have always been here. The event fields joined them: they are the same
 * kind of thing declared the same way - a name, a type, its allowed values and the industry it belongs to -
 * and they were being declared on the Types page, which is a page about the shapes an event and an entity
 * take rather than about the questions they answer. A field is a question. It belongs here.
 */
type FieldSection = 'event' | 'own' | 'additional'

interface SectionItem {
  title: string
  value: FieldSection
}

interface OperatorItem {
  title: string
  value: DependencyOperator
}

const DEPENDENCY_OPERATORS: DependencyOperator[] = ['has_value', 'is_empty', 'one_of', 'not_equals']

/** What each kind of value is called where a person picks it: the short name a programmer would write. */
const TYPE_LABELS: Record<FieldType, string> = {
  string: 'STRING',
  text: 'TEXT',
  number: 'FLOAT',
  integer: 'INT',
  boolean: 'BOOL',
  date: 'DATE',
  datetime: 'DATETIME',
  enum: 'ENUM',
  json: 'JSON',
  coordinate: 'COORDINATE',
  file: 'FILE',
}

const typeLabel = (type: FieldType): string => TYPE_LABELS[type] ?? type.toUpperCase()

/** The two names of a stored declaration, whose Hebrew name lives among its descriptors. */
const fieldNames = (field: FieldDefinition): NamePair =>
  splitNames({ name: field.name, name_he: field.metadata.name_he })
</script>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import {
  EMPTY_PLACEHOLDER,
  KeyField,
  NAME_DIRECTIONS,
  NEUTRAL_TOKEN,
  NameFields,
  SectionHeader,
  UiChip,
  UnsavedChangesDialog,
  hasAName,
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
import { useIndustries } from '@/composables/useIndustries'
import { useRenameSummary } from '@/composables/useRenameSummary'
import {
  createField,
  deleteField,
  listEntityTypes,
  listEventTypes,
  listFields,
  previewFieldRename,
  updateEventType,
  updateField,
} from '@/requests/schema'

const { t, language, direction } = useLanguage()

/*
 * The event fields, and the two halves of an entity form. Both halves are stored in the same place and both
 * become columns of the entity table, so the only thing the section decides is where the field is asked for.
 */
const sectionItems = computed<SectionItem[]>(() => {
  void language.value

  return [
    { title: t('schema.sectionEvent'), value: 'event' },
    { title: t('schema.sectionEntity'), value: 'own' },
    { title: t('schema.sectionAdditional'), value: 'additional' },
  ]
})

const operatorItems = computed<OperatorItem[]>(() => {
  void language.value

  return DEPENDENCY_OPERATORS.map((value) => ({ title: t(`schema.operator.${value}`), value }))
})

const TYPE_OPTIONS: FieldType[] = [
  'string',
  'text',
  'number',
  'integer',
  'boolean',
  'date',
  'datetime',
  'enum',
  'json',
  'coordinate',
]

/*
 * The types a field may hold a list of. A list of truth values says nothing a single one does not, a JSON value
 * is already whatever shape it likes, and a point is picked on a map one at a time.
 */
const LISTABLE_TYPES: ReadonlySet<FieldType> = new Set<FieldType>([
  'string',
  'text',
  'number',
  'integer',
  'date',
  'datetime',
  'enum',
])

const typeItems = TYPE_OPTIONS.map((value) => ({ title: typeLabel(value), value }))

const nameSides = computed<NameSide[]>(() => nameColumnOrder())

const { industries, load, findIndustry } = useIndustries()
const { notify, reportError } = useSnackbar()

const section = ref<FieldSection>('event')
const industry = ref<string | null>(null)
const fields = ref<FieldDefinition[]>([])
const dialog = ref<boolean>(false)
const saving = ref<boolean>(false)
const triedToSave = ref<boolean>(false)
const openedWith = ref<string>('')

/* The declaration being changed, or nothing while a new one is being written. */
const edited = ref<FieldDefinition | null>(null)

/* Whether the key of a stored declaration is being changed, which is a deliberate act rather than a typo. */
const renaming = ref<boolean>(false)
const renamePreview = ref<RenameResult | null>(null)
const renameSummary = useRenameSummary(renamePreview)

const draftEnglish = ref<string>('')
const draftHebrew = ref<string>('')
const draftKey = ref<string>('')
const draftType = ref<FieldType>('string')
const draftSection = ref<FieldSection>('event')
const draftIndustry = ref<string | null>(null)
const draftEntityType = ref<string | null>(null)
const draftOptions = ref<string[]>([])
const draftDescription = ref<string>('')
const draftDependencies = ref<FieldDependency[]>([])
const entityTypes = ref<EntityType[]>([])
const eventTypes = ref<EventType[]>([])
/* The keys of the event types that ask for the field, which is stored on the types rather than on the field. */
const draftEventTypes = ref<string[]>([])
const draftRequired = ref<boolean>(false)
const draftVisible = ref<boolean>(true)
const draftArray = ref<boolean>(false)
const ownScopeFields = ref<FieldDefinition[]>([])

const industryItems = computed<SelectItem[]>(() => {
  void language.value
  const offered =
    typeIndustries.value.length > 0
      ? industries.value.filter((candidate) => typeIndustries.value.includes(candidate.key))
      : industries.value

  return [
    { title: t('common.allIndustries'), value: null },
    ...offered.map((candidate) => ({ title: localName(candidate), value: candidate.key })),
  ]
})

const industryFilterItems = computed<SelectItem[]>(() => {
  void language.value

  return [
    { title: t('common.allIndustries'), value: null },
    ...industries.value.map((candidate) => ({ title: localName(candidate), value: candidate.key })),
  ]
})

const industryName = (key: string): string => {
  const found = findIndustry(key)

  return found === undefined ? key : localName(found)
}

const industryIcon = (key: string): string => findIndustry(key)?.icon ?? ''

const entityTypeName = (key: string): string => {
  const found = entityTypes.value.find((candidate) => candidate.key === key)

  return found === undefined ? key : localName(found)
}

/* Every declared entity type is offered, each one saying which industries it belongs to. */
const entityTypeItems = computed<SelectItem[]>(() => {
  void language.value

  return [
    { title: t('schema.everyEntityType'), value: null },
    ...entityTypes.value.map((candidate) => {
      const owners = joinIsolated(candidate.industries.map(industryName))

      return {
        title: joinIsolated([localName(candidate), owners], ' · '),
        value: candidate.key,
      }
    }),
  ]
})

/* What the event types asking for a field are called, in the order they were declared. */
const eventTypeNames = (key: string): string =>
  joinIsolated(
    eventTypes.value.filter((candidate) => candidate.custom_fields.includes(key)).map((candidate) => localName(candidate)),
  )

/* The event types a field of an industry may be bound to: the shared ones and that industry's own. */
const eventTypesFor = (industryKey: string | null): EventType[] =>
  eventTypes.value.filter(
    (candidate) =>
      industryKey === null || candidate.industries.length === 0 || candidate.industries.includes(industryKey),
  )

const offeredEventTypeKeys = computed<string[]>(() =>
  eventTypesFor(draftIndustry.value).map((candidate) => candidate.key),
)

const eventTypeItems = computed<SelectItem[]>(() => {
  void language.value

  return eventTypesFor(draftIndustry.value).map((candidate) => {
    const owners = joinIsolated(candidate.industries.map(industryName))

    return {
      title: owners.length > 0 ? joinIsolated([localName(candidate), owners], ' · ') : localName(candidate),
      value: candidate.key,
    }
  })
})

const allEventTypesChosen = computed<boolean>(
  () =>
    offeredEventTypeKeys.value.length > 0
    && offeredEventTypeKeys.value.every((key) => draftEventTypes.value.includes(key)),
)

const toggleAllEventTypes = () => {
  draftEventTypes.value = allEventTypesChosen.value ? [] : [...offeredEventTypeKeys.value]
}

/*
 * Follow a change of industry or section with the event types the field may still be bound to. A selection
 * that was everything the previous industry offered stays everything, so the default survives the change.
 */
const followEventTypes = (previousIndustry: string | null) => {
  if (!dialog.value || !draftIsEventScope.value) {
    return
  }

  const previous = eventTypesFor(previousIndustry).map((candidate) => candidate.key)
  const wasAll = draftEventTypes.value.length === 0 || previous.every((key) => draftEventTypes.value.includes(key))
  draftEventTypes.value =
    edited.value === null && wasAll
      ? [...offeredEventTypeKeys.value]
      : draftEventTypes.value.filter((key) => offeredEventTypeKeys.value.includes(key))
}

/* A key is declared once for its scope, its industry and its entity type. */
const takenKeys = computed<string[]>(() =>
  edited.value === null
    ? fields.value
        .filter(
          (field) =>
            field.scope === (draftIsEventScope.value ? 'event' : 'entity')
            && field.industry === resolvedIndustry.value
            && field.entity_type === (draftIsEventScope.value ? null : draftEntityType.value),
        )
        .map((field) => field.key)
    : [],
)

const canBeList = computed<boolean>(() => LISTABLE_TYPES.has(draftType.value))

/* What is stored: a type that cannot be a list is saved as a single value whatever the box last said. */
const storedArray = computed<boolean>(() => canBeList.value && draftArray.value)

/* An event field is declared for the event itself; the other two sections describe the entities inside it. */
const isEventScope = computed<boolean>(() => section.value === 'event')

const draftIsEventScope = computed<boolean>(() => draftSection.value === 'event')

const chosenEntityType = computed<EntityType | null>(
  () => entityTypes.value.find((candidate) => candidate.key === draftEntityType.value) ?? null,
)

/* The industries the chosen type belongs to, which is what the field may be declared for at all. */
const typeIndustries = computed<string[]>(() => chosenEntityType.value?.industries ?? [])

/*
 * A field belongs to one industry, so the question is only skipped where the answer is already settled: a
 * type shared by everybody leaves the field shared, and a type of a single industry hands that one over. A
 * type that serves several is the one case where the answer still has to be picked out of them.
 */
const industryIsAsked = computed<boolean>(
  () => draftIsEventScope.value || chosenEntityType.value === null || typeIndustries.value.length > 1,
)

const resolvedIndustry = computed<string | null>(() =>
  industryIsAsked.value ? draftIndustry.value : (typeIndustries.value[0] ?? null),
)

const snapshot = (): string =>
  JSON.stringify([
    draftEnglish.value,
    draftHebrew.value,
    draftKey.value,
    draftType.value,
    draftSection.value,
    draftIndustry.value,
    draftEntityType.value,
    draftOptions.value,
    draftDescription.value,
    draftDependencies.value,
    draftEventTypes.value,
    draftRequired.value,
    draftVisible.value,
    draftArray.value,
  ])

const canSave = computed<boolean>(
  () =>
    hasAName({ english: draftEnglish.value, hebrew: draftHebrew.value })
    && isValidKey(draftKey.value)
    && !takenKeys.value.includes(draftKey.value.trim())
    && (draftType.value !== 'enum' || draftOptions.value.length > 0)
    && (!draftIsEventScope.value || draftEventTypes.value.length > 0),
)

const { confirmOpen, attemptClose, discard } = useDirtyGuard({
  isDirty: () => snapshot() !== openedWith.value,
  close: () => {
    dialog.value = false
  },
})

/*
 * A condition may point at any other field of the same entity form, whichever of its two halves that field
 * was declared in: both halves are filled in together and both end up in the same set of values.
 */
const dependencyCandidates = computed<SelectItem[]>(() =>
  ownScopeFields.value
    .filter((candidate) => candidate.key !== draftKey.value)
    .map((candidate) => ({
      title: localName({ name: candidate.name, name_he: candidate.metadata.name_he }),
      value: candidate.key,
    })),
)

const addDependency = () => {
  const first = dependencyCandidates.value[0]?.value
  if (first === undefined || first === null) {
    return
  }

  draftDependencies.value = [...draftDependencies.value, { field: first, operator: 'has_value', values: [] }]
}

const removeDependency = (index: number) => {
  draftDependencies.value = draftDependencies.value.filter((_, candidate) => candidate !== index)
}

const reload = async (): Promise<void> => {
  try {
    /* The listing follows the filters, while the entity types are read whole: the dialog reads the
       industry off the type the user picks, so it may not only offer the types of one industry. */
    /* Every industry is the shared declarations and each industry's own, each declaration once. */
    const scopes: (string | null)[] =
      industry.value === null ? [null, ...industries.value.map((candidate) => candidate.key)] : [industry.value]
    const [lists, types, declaredEventTypes] = await Promise.all([
      Promise.all(
        scopes.map((scope) =>
          isEventScope.value
            ? listFields({ scope: 'event', industry: scope })
            : listFields({ scope: 'entity', industry: scope, additional: section.value === 'additional' }),
        ),
      ),
      listEntityTypes(),
      listEventTypes(null),
    ])
    const unique = new Map<string, FieldDefinition>()
    lists.flat().forEach((field) => unique.set(field.id, field))
    fields.value = [...unique.values()]
    entityTypes.value = types
    eventTypes.value = declaredEventTypes
  } catch (error) {
    reportError(error)
  }
}

/**
 * Read the fields a condition of the current draft may point at, which is not what the listing shows.
 *
 * The listing follows the filters of the page, and a condition that points at a field of another form can
 * never hold - which is exactly how a dependency that does nothing gets declared. The candidates therefore
 * follow the draft itself: its own scope and industry, plus the event of an entity.
 */
const loadCandidates = async (): Promise<void> => {
  if (draftIsEventScope.value) {
    ownScopeFields.value = []

    return
  }

  const owner = resolvedIndustry.value
  try {
    const entityFields = await listFields({
      scope: 'entity',
      industry: owner,
      entityType: draftEntityType.value,
    })
    /* A field declared for every entity type shares its form with the fields of no single type only. */
    ownScopeFields.value =
      draftEntityType.value === null
        ? entityFields.filter((candidate) => candidate.entity_type === null)
        : entityFields
  } catch (error) {
    reportError(error)
  }
}

/**
 * Follow the draft with the candidates it may depend on, dropping conditions the new scope cannot hold.
 */
const refreshCandidates = async (): Promise<void> => {
  if (!dialog.value) {
    return
  }

  await loadCandidates()
  const offered = new Set(dependencyCandidates.value.map((candidate) => candidate.value))
  draftDependencies.value = draftDependencies.value.filter((dependency) => offered.has(dependency.field))
}

/* The key follows the English name while a new field is written; a stored key never moves by itself. */
const onEnglishChange = (value: string) => {
  if (edited.value === null && draftKey.value === toKey(draftEnglish.value)) {
    draftKey.value = toKey(value)
  }
  draftEnglish.value = value
}

/** Put the form back to an empty declaration of whatever section the page is showing. */
const resetDraft = () => {
  edited.value = null
  renaming.value = false
  renamePreview.value = null
  triedToSave.value = false
  draftEnglish.value = ''
  draftHebrew.value = ''
  draftKey.value = ''
  draftType.value = 'string'
  draftSection.value = section.value
  draftIndustry.value = industry.value
  draftEntityType.value = null
  draftOptions.value = []
  draftDescription.value = ''
  draftDependencies.value = []
  draftEventTypes.value = []
  draftRequired.value = false
  draftVisible.value = true
  draftArray.value = false
}

const openCreate = () => {
  resetDraft()
  /* A new event field is bound to every event type of its industry until some are taken off. */
  draftEventTypes.value = [...offeredEventTypeKeys.value]
  openedWith.value = snapshot()
  dialog.value = true
}

/**
 * Open a stored declaration for changing, with its key held back behind a deliberate act.
 */
const openEdit = (field: FieldDefinition) => {
  resetDraft()
  edited.value = field
  const names = fieldNames(field)
  draftEnglish.value = names.english
  draftHebrew.value = names.hebrew
  draftKey.value = field.key
  draftType.value = field.type
  draftSection.value = field.scope === 'event' ? 'event' : field.additional ? 'additional' : 'own'
  draftIndustry.value = field.industry
  draftEntityType.value = field.entity_type
  draftOptions.value = [...field.metadata.options]
  draftDescription.value = field.metadata.description ?? ''
  draftDependencies.value = field.depends_on.map((dependency) => ({ ...dependency }))
  /* Only a type of the field's own industry can ask for it, so a binding to any other one is let go. */
  draftEventTypes.value =
    field.scope === 'event'
      ? eventTypesFor(field.industry)
          .filter((candidate) => candidate.custom_fields.includes(field.key))
          .map((candidate) => candidate.key)
      : []
  draftRequired.value = field.required
  draftVisible.value = field.visible
  draftArray.value = field.array
  openedWith.value = snapshot()
  dialog.value = true
}

/**
 * Unlock the key and ask the service what changing it would cost before anybody commits to it.
 */
const startRename = async (): Promise<void> => {
  renaming.value = true
  const field = edited.value
  if (field === null) {
    return
  }

  try {
    renamePreview.value = await previewFieldRename(field.id, field.key)
  } catch (error) {
    reportError(error)
  }
}

/** The descriptors a declaration renders with, which both writing and changing one hand over. */
const draftMetadata = () => ({
  allowed_file_types: [],
  name_he: draftHebrew.value.trim().length > 0 ? draftHebrew.value.trim() : null,
  options: draftOptions.value,
  unit: null,
  description: draftDescription.value.length > 0 ? draftDescription.value : null,
  placeholder: null,
  group: null,
})

/**
 * Bind the field to exactly the event types picked for it, by changing the list of fields each type asks for.
 *
 * Only the types whose answer changed are written. A key that was just renamed is already carried through
 * those lists by the service, so the list read before the save is read with the old key standing for the new.
 */
const bindEventTypes = async (key: string, previousKey: string | null): Promise<void> => {
  const chosen = new Set(draftEventTypes.value)
  /*
   * Only the types of the field's own industry are touched: the same key may be declared again by another
   * industry, and the types of that one ask for their own declaration, not for this one.
   */
  const changes = eventTypesFor(resolvedIndustry.value).flatMap((candidate) => {
    const asked = candidate.custom_fields.map((field) => (field === previousKey ? key : field))
    const bound = asked.includes(key)
    const wanted = chosen.has(candidate.key)
    if (bound === wanted) {
      return []
    }

    return [{ id: candidate.id, fields: wanted ? [...asked, key] : asked.filter((field) => field !== key) }]
  })

  await Promise.all(changes.map((change) => updateEventType(change.id, { custom_fields: change.fields })))
}

const onSave = async (): Promise<void> => {
  triedToSave.value = true
  if (!canSave.value) {
    return
  }

  saving.value = true
  try {
    const field = edited.value
    const { name } = joinNames({ english: draftEnglish.value, hebrew: draftHebrew.value })
    if (field === null) {
      await createField({
        name,
        key: draftKey.value.trim(),
        type: draftType.value,
        array: storedArray.value,
        default: null,
        required: draftRequired.value,
        scope: draftIsEventScope.value ? 'event' : 'entity',
        industry: resolvedIndustry.value,
        entity_type: draftIsEventScope.value ? null : draftEntityType.value,
        additional: draftSection.value === 'additional',
        metadata: draftMetadata(),
        constraints: [],
        depends_on: draftDependencies.value,
        filterable: true,
        sortable: true,
        editable: true,
        visible: draftVisible.value,
        order: 100,
      })
    } else {
      const moved = draftKey.value.trim() !== field.key
      await updateField(field.id, {
        key: moved ? draftKey.value.trim() : undefined,
        name,
        type: draftType.value,
        array: storedArray.value,
        required: draftRequired.value,
        visible: draftVisible.value,
        metadata: draftMetadata(),
        depends_on: draftDependencies.value,
      })
    }

    if (draftIsEventScope.value) {
      await bindEventTypes(draftKey.value.trim(), field === null ? null : field.key)
    }

    notify(t('common.saved'), 'success')
    dialog.value = false
    resetDraft()
    await reload()
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}

const onDelete = async (fieldId: string): Promise<void> => {
  try {
    await deleteField(fieldId)
    notify(t('common.removed'), 'success')
    await reload()
  } catch (error) {
    reportError(error)
  }
}

onMounted(async () => {
  await load()
  await reload()
})

watch([section, industry], reload)
watch([dialog, draftIndustry, draftEntityType], refreshCandidates)
watch([draftIndustry, draftSection], (_, [previousIndustry]) => followEventTypes(previousIndustry))
</script>

<style scoped>
.schema__type {
  font-family: ui-monospace, 'SFMono-Regular', 'Consolas', monospace;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.schema__pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem;
}

.schema__flags {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.schema__dependencies {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border: 0.0625rem solid rgb(var(--v-theme-app-border));
  border-radius: 0.5rem;
  padding: 0.75rem;
}

/* One condition reads as a sentence across the row: this field, tested this way, against these values. */
.schema__dependency {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.5rem;
}

@media (max-width: 40rem) {
  .schema__dependency {
    grid-template-columns: 1fr;
  }
}
</style>
