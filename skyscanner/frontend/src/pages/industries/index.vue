<template>
  <div class="sky-page">
    <AppHeader />

    <div class="sky-page__content settings">
      <div class="settings__heading">
        <h1 class="settings__title">
          {{ t('app.industries') }}
        </h1>
        <v-spacer />
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="openCreate"
        >
          {{ t('industries.new') }}
        </v-btn>
      </div>

      <div class="settings__grid">
        <article
          v-for="industry in industries"
          :key="industry.key"
          class="industry-card"
        >
          <RouterLink
            class="industry-card__open"
            :to="{ path: '/events', query: { industries: industry.key } }"
          >
            <span class="industry-card__icon">
              <v-icon
                :icon="industry.icon"
                size="28"
              />
            </span>
            <span class="industry-card__names">
              <span
                class="industry-card__name"
                dir="auto"
              >{{ localName(industry) }}</span>
              <code class="industry-card__key">{{ industry.key }}</code>
            </span>
            <span class="industry-card__count">
              <v-icon
                size="16"
                icon="mdi-calendar-text-outline"
              />
              {{ industry.event_count }}
            </span>
          </RouterLink>

          <p
            v-if="industry.description.length > 0"
            class="industry-card__description"
            dir="auto"
          >
            <UiLinkedText :text="industry.description" />
          </p>

          <div
            v-if="industry.modules.length > 0"
            class="industry-card__modules"
          >
            <UiChip
              v-for="module in industry.modules"
              :key="module"
              :label="module"
              :token="NEUTRAL_TOKEN"
            />
          </div>

          <div class="industry-card__actions">
            <v-btn
              size="small"
              variant="text"
              prepend-icon="mdi-pencil-outline"
              @click="openEdit(industry)"
            >
              {{ t('common.edit') }}
            </v-btn>
          </div>
        </article>
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
      max-width="36rem"
      scrollable
      @update:model-value="attemptClose"
    >
      <v-card>
        <v-card-title>{{ editedKey === null ? t('industries.newTitle') : t('industries.edit') }}</v-card-title>
        <v-card-text class="settings__dialog">
          <NameFields
            :english="draftEnglish"
            :hebrew="draftHebrew"
            :show-errors="triedToSave"
            autofocus
            @update:english="onEnglishChange"
            @update:hebrew="draftHebrew = $event"
          />
          <KeyField
            v-model="draftKey"
            :disabled="editedKey !== null"
            :taken="takenKeys"
          />
          <v-text-field
            v-model="draftDescription"
            :label="t('common.description')"
            dir="auto"
          />
          <IconPicker v-model="draftIcon" />
          <v-combobox
            v-model="draftModules"
            :label="t('industries.modules')"
            :hint="t('input.pressEnter')"
            persistent-hint
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

    <UnsavedChangesDialog
      v-model="confirmOpen"
      @discard="discard"
    />
  </div>
</template>

<script lang="ts">
import type { Industry } from '@/models/industry'

/** What a new industry is drawn with until another icon is picked. */
const DEFAULT_ICON = 'mdi-domain'
</script>

<script setup lang="ts">
import {
  KeyField,
  NEUTRAL_TOKEN,
  NameFields,
  UiChip,
  UnsavedChangesDialog,
  hasAName,
  isValidKey,
  joinNames,
  localName,
  splitNames,
  toKey,
  useDirtyGuard,
  useLanguage,
  useSnackbar,
  UiLinkedText,
} from '@truth-platform/core-ui'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import IconPicker from '@/components/IconPicker.vue'
import { useIndustries } from '@/composables/useIndustries'
import { createIndustry, updateIndustry } from '@/requests/schema'

const { t } = useLanguage()
const { industries, loading, load } = useIndustries()
const { notify, reportError } = useSnackbar()

const dialog = ref<boolean>(false)
const saving = ref<boolean>(false)
const triedToSave = ref<boolean>(false)
const editedKey = ref<string | null>(null)
const draftEnglish = ref<string>('')
const draftHebrew = ref<string>('')
const draftKey = ref<string>('')
const draftDescription = ref<string>('')
const draftIcon = ref<string>(DEFAULT_ICON)
const draftModules = ref<string[]>([])
const openedWith = ref<string>('')

const takenKeys = computed<string[]>(() =>
  editedKey.value === null ? industries.value.map((industry) => industry.key) : [],
)

const snapshot = (): string =>
  JSON.stringify([
    draftEnglish.value,
    draftHebrew.value,
    draftKey.value,
    draftDescription.value,
    draftIcon.value,
    draftModules.value,
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

/* The key follows the English name while a new industry is written; a stored key never moves. */
const onEnglishChange = (value: string) => {
  if (editedKey.value === null && draftKey.value === toKey(draftEnglish.value)) {
    draftKey.value = toKey(value)
  }
  draftEnglish.value = value
}

const openWith = (industry: Industry | null) => {
  editedKey.value = industry?.key ?? null
  const names = industry === null ? { english: '', hebrew: '' } : splitNames(industry)
  draftEnglish.value = names.english
  draftHebrew.value = names.hebrew
  draftKey.value = industry?.key ?? ''
  draftDescription.value = industry?.description ?? ''
  draftIcon.value = industry?.icon ?? DEFAULT_ICON
  draftModules.value = [...(industry?.modules ?? [])]
  triedToSave.value = false
  openedWith.value = snapshot()
  dialog.value = true
}

const openCreate = () => {
  openWith(null)
}

const openEdit = (industry: Industry) => {
  openWith(industry)
}

const onSave = async (): Promise<void> => {
  triedToSave.value = true
  if (!canSave.value) {
    return
  }

  saving.value = true
  try {
    const names = joinNames({ english: draftEnglish.value, hebrew: draftHebrew.value })
    const modules = draftModules.value.map((module) => module.trim()).filter((module) => module.length > 0)
    if (editedKey.value === null) {
      await createIndustry({
        key: draftKey.value.trim(),
        ...names,
        description: draftDescription.value.trim(),
        icon: draftIcon.value,
        modules,
      })
    } else {
      await updateIndustry(editedKey.value, {
        ...names,
        description: draftDescription.value.trim(),
        icon: draftIcon.value,
        modules,
      })
    }

    notify(t('common.saved'), 'success')
    dialog.value = false
    await load(true)
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void load(true)
})
</script>

<style scoped>
.industry-card {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 1rem;
  border: 0.0625rem solid rgb(var(--v-theme-app-border));
  border-radius: 0.75rem;
  background-color: rgb(var(--v-theme-surface));
}

.industry-card__open {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: inherit;
  text-decoration: none;
}

.industry-card__open:hover .industry-card__name {
  text-decoration: underline;
}

.industry-card__icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  inline-size: 3rem;
  block-size: 3rem;
  border-radius: 0.75rem;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}

.industry-card__names {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: flex-start;
  min-inline-size: 0;
}

.industry-card__name {
  max-inline-size: 100%;
  overflow: hidden;
  font-size: 1.0625rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.industry-card__key {
  font-size: 0.75rem;
  opacity: 0.65;
}

.industry-card__count {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.industry-card__description {
  font-size: 0.875rem;
  opacity: 0.8;
}

.industry-card__modules {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.industry-card__actions {
  display: flex;
  justify-content: flex-end;
  margin-block-start: auto;
}
</style>
