<template>
  <div class="sky-page">
    <AppHeader />

    <div class="sky-page__content settings">
      <div class="settings__heading">
        <h1 class="settings__title">
          {{ t('app.platforms') }}
        </h1>
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
          {{ t('platforms.new') }}
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
              <th>{{ t('app.industries') }}</th>
              <th>{{ t('common.description') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="platform in shownPlatforms"
              :key="platform.id"
            >
              <td
                v-for="side in nameSides"
                :key="side"
              >
                <span
                  class="ui-name"
                  :dir="NAME_DIRECTIONS[side]"
                >{{ splitNames(platform)[side] || EMPTY_PLACEHOLDER }}</span>
              </td>
              <td>
                <code
                  class="ui-name"
                  dir="ltr"
                >{{ platform.key }}</code>
              </td>
              <td>
                <span class="settings__chips">
                  <UiChip
                    v-for="key in platform.industries"
                    :key="key"
                    :label="industryName(key)"
                    :icon="industryIcon(key)"
                    :token="NEUTRAL_TOKEN"
                  />
                  <span v-if="platform.industries.length === 0">{{ t('common.allIndustries') }}</span>
                </span>
              </td>
              <td>
                <span dir="auto"><UiLinkedText :text="platform.description || EMPTY_PLACEHOLDER" /></span>
              </td>
              <td class="settings__row-actions">
                <v-btn
                  icon="mdi-pencil-outline"
                  size="small"
                  variant="text"
                  :aria-label="t('common.edit')"
                  :title="t('common.edit')"
                  @click="openWith(platform)"
                />
                <v-btn
                  icon="mdi-delete-outline"
                  size="small"
                  variant="text"
                  :aria-label="t('common.remove')"
                  :title="t('common.remove')"
                  @click="askRemove(platform)"
                />
              </td>
            </tr>
            <tr v-if="!loading && shownPlatforms.length === 0">
              <td
                colspan="6"
                class="settings__empty"
              >
                {{ EMPTY_PLACEHOLDER }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <div
        v-if="loading"
        class="settings__loading"
      >
        <v-progress-circular
          indeterminate
          color="primary"
          size="32"
        />
      </div>
    </div>

    <v-dialog
      :model-value="dialog"
      max-width="34rem"
      @update:model-value="attemptClose"
    >
      <v-card>
        <v-card-title>{{ edited === null ? t('platforms.newTitle') : t('platforms.edit') }}</v-card-title>
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
            The key is what every event that ran on this platform stores, so changing a stored one is a write
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
          <!-- Every platform belongs to at least one industry, which is what offers it on that industry's events. -->
          <v-select
            v-model="draftIndustries"
            :items="industryOptions"
            item-title="title"
            item-value="value"
            :label="t('app.industries')"
            :error-messages="industriesMissing ? t('platforms.industryRequired') : undefined"
            multiple
            chips
            closable-chips
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

    <v-dialog
      v-model="removeDialog"
      max-width="28rem"
    >
      <v-card>
        <v-card-title>{{ t('platforms.removeTitle') }}</v-card-title>
        <v-card-text>{{ t('platforms.removeBody') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            @click="removeDialog = false"
          >
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn
            color="error"
            :loading="saving"
            @click="onRemove"
          >
            {{ t('common.remove') }}
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
import type { Platform } from '@/models/platform'
import type { NameSide } from '@truth-platform/core-ui'
import type { RenameResult } from '@/requests/schema'

interface IndustryOption {
  title: string
  value: string
}

interface IndustryFilterItem {
  title: string
  value: string | null
}

const DEFAULT_ORDER = 100
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
  isValidKey,
  joinNames,
  localName,
  nameColumnOrder,
  splitNames,
  toKey,
  useDirtyGuard,
  useLanguage,
  useSnackbar,
  UiLinkedText,
} from '@truth-platform/core-ui'
import { computed, onMounted, ref } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import { useIndustries } from '@/composables/useIndustries'
import { useRenameSummary } from '@/composables/useRenameSummary'
import {
  createPlatform,
  deletePlatform,
  listPlatforms,
  previewPlatformRename,
  updatePlatform,
} from '@/requests/schema'
import { platformServes } from '@/utils/platforms'

const { t, language, direction } = useLanguage()
const { industries, findIndustry } = useIndustries()
const { notify, reportError } = useSnackbar()

const platforms = ref<Platform[]>([])
const loading = ref<boolean>(false)

const nameSides = computed<NameSide[]>(() => nameColumnOrder())

/* The industry the listing is narrowed to, or nothing for every platform. */
const industry = ref<string | null>(null)
const saving = ref<boolean>(false)
const triedToSave = ref<boolean>(false)

const dialog = ref<boolean>(false)
const removeDialog = ref<boolean>(false)
const edited = ref<Platform | null>(null)
const draftEnglish = ref<string>('')
const draftHebrew = ref<string>('')
const draftKey = ref<string>('')
const draftDescription = ref<string>('')
const draftIndustries = ref<string[]>([])
const openedWith = ref<string>('')

/* Whether the key of a stored platform is being changed, which is a deliberate act rather than a typo. */
const renaming = ref<boolean>(false)
const renamePreview = ref<RenameResult | null>(null)
const renameSummary = useRenameSummary(renamePreview)

const industryOptions = computed<IndustryOption[]>(() => {
  void language.value

  return industries.value.map((industry) => ({ title: localName(industry), value: industry.key }))
})

const industryFilterItems = computed<IndustryFilterItem[]>(() => [
  { title: t('common.allIndustries'), value: null },
  ...industryOptions.value,
])

/* The platforms an event of the picked industry may name, which includes the ones not yet linked to any. */
const shownPlatforms = computed<Platform[]>(() =>
  industry.value === null
    ? platforms.value
    : platforms.value.filter((platform) => platformServes(platform, industry.value ?? '')),
)

const industryName = (key: string): string => {
  const industry = findIndustry(key)

  return industry === undefined ? key : localName(industry)
}

const industryIcon = (key: string): string => findIndustry(key)?.icon ?? ''

/* A key names one platform only; the one being edited may keep its own. */
const takenKeys = computed<string[]>(() =>
  platforms.value.filter((platform) => platform.id !== edited.value?.id).map((platform) => platform.key),
)

const snapshot = (): string =>
  JSON.stringify([draftEnglish.value, draftHebrew.value, draftKey.value, draftDescription.value, draftIndustries.value])

const industriesMissing = computed<boolean>(() => triedToSave.value && draftIndustries.value.length === 0)

const canSave = computed<boolean>(
  () =>
    hasAName({ english: draftEnglish.value, hebrew: draftHebrew.value })
    && isValidKey(draftKey.value)
    && !takenKeys.value.includes(draftKey.value.trim())
    && draftIndustries.value.length > 0,
)

const { confirmOpen, attemptClose, discard } = useDirtyGuard({
  isDirty: () => snapshot() !== openedWith.value,
  close: () => {
    dialog.value = false
  },
})

/* The key follows the English name while a new platform is written, exactly as it was typed. */
const onEnglishChange = (value: string) => {
  if (edited.value === null && draftKey.value === toKey(draftEnglish.value)) {
    draftKey.value = toKey(value)
  }
  draftEnglish.value = value
}

const load = async (): Promise<void> => {
  loading.value = true
  try {
    platforms.value = await listPlatforms()
  } catch (error) {
    reportError(error)
  } finally {
    loading.value = false
  }
}

const openWith = (platform: Platform | null) => {
  edited.value = platform
  const names = platform === null ? { english: '', hebrew: '' } : splitNames(platform)
  draftEnglish.value = names.english
  draftHebrew.value = names.hebrew
  draftKey.value = platform?.key ?? ''
  draftDescription.value = platform?.description ?? ''
  /* A new platform starts in the industry the listing is narrowed to, which is usually the one it is for. */
  draftIndustries.value =
    platform === null ? (industry.value === null ? [] : [industry.value]) : [...platform.industries]
  renaming.value = false
  renamePreview.value = null
  triedToSave.value = false
  openedWith.value = snapshot()
  dialog.value = true
}

/**
 * Unlock the key and ask the service what changing it would cost before anybody commits to it.
 */
const startRename = async (): Promise<void> => {
  renaming.value = true
  const platform = edited.value
  if (platform === null) {
    return
  }

  try {
    renamePreview.value = await previewPlatformRename(platform.id, platform.key)
  } catch (error) {
    reportError(error)
  }
}

const onSave = async (): Promise<void> => {
  triedToSave.value = true
  if (!canSave.value) {
    return
  }

  saving.value = true
  try {
    const names = joinNames({ english: draftEnglish.value, hebrew: draftHebrew.value })
    const platform = edited.value
    if (platform === null) {
      await createPlatform({
        key: draftKey.value.trim(),
        ...names,
        description: draftDescription.value.trim(),
        industries: [...draftIndustries.value],
        order: DEFAULT_ORDER,
      })
    } else {
      const moved = draftKey.value.trim() !== platform.key
      await updatePlatform(platform.id, {
        key: moved ? draftKey.value.trim() : undefined,
        ...names,
        description: draftDescription.value.trim(),
        industries: [...draftIndustries.value],
      })
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

const askRemove = (platform: Platform) => {
  edited.value = platform
  removeDialog.value = true
}

const onRemove = async (): Promise<void> => {
  const platform = edited.value
  if (platform === null) {
    return
  }

  saving.value = true
  try {
    await deletePlatform(platform.id)
    notify(t('common.removed'), 'success')
    removeDialog.value = false
    await load()
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
