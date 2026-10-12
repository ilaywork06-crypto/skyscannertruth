<template>
  <div class="sky-page">
    <AppHeader :industries="industries" />

    <div class="sky-page__content schemas">
      <div class="schemas__heading">
        <h1 class="schemas__title">
          {{ t('schemas.title') }}
        </h1>
        <v-spacer />
        <v-btn
          color="primary"
          prepend-icon="mdi-plus"
          @click="createOpen = true"
        >
          {{ t('schemas.new') }}
        </v-btn>
      </div>

      <p class="schemas__note">
        {{ t('schemas.note') }}
      </p>

      <v-text-field
        v-model="search"
        class="schemas__search"
        :placeholder="t('schemas.search')"
        prepend-inner-icon="mdi-magnify"
        rounded="pill"
        clearable
        hide-details
      />

      <div
        v-if="loading"
        class="schemas__loading"
      >
        <v-progress-circular
          indeterminate
          color="primary"
        />
      </div>

      <div
        v-else-if="matched.length === 0"
        class="schemas__empty"
      >
        {{ schemas.length === 0 ? t('schemas.empty') : t('schemas.noMatch') }}
      </div>

      <div
        v-else
        class="schemas__grid"
      >
        <v-card
          v-for="schema in matched"
          :key="schema.id"
          class="schemas__card"
          :to="`/schemas/${schema.id}`"
          link
        >
          <div class="schemas__card-head">
            <v-icon
              size="20"
              icon="mdi-table-cog"
            />
            <h2
              class="schemas__card-title"
              dir="auto"
            >
              {{ schema.name }}
            </h2>
            <span class="schemas__revision">{{ t('schemas.revision', { number: schema.revision }) }}</span>
          </div>
          <div class="schemas__industries">
            <UiChip
              v-for="industry in industriesOf(schema.id)"
              :key="industry.id"
              :label="industry.name"
              :token="hashedToken(industry.name)"
            />
            <span
              v-if="industriesOf(schema.id).length === 0"
              class="schemas__meta"
            >{{ isGlobal(schema.id) ? t('schemas.globalShort') : t('schemas.allIndustries') }}</span>
          </div>
          <span class="schemas__meta">
            {{ attributeCount(schema.id) }}
            ·
            <span dir="ltr">{{ formatDateTime(schema.created_at) }}</span>
            · {{ schema.creator }}
          </span>
        </v-card>
      </div>
    </div>

    <CreateSchemaDialog
      v-model="createOpen"
      @created="onCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { UiChip, formatDateTime, hashedToken, useLanguage, useSnackbar } from '@truth-platform/core-ui'
import { computed, ref } from 'vue'

import AppHeader from '@/components/AppHeader.vue'
import CreateSchemaDialog from '@/components/CreateSchemaDialog.vue'
import { useRegister } from '@/composables/useRegister'
import type { Industry } from '@/models/industry'
import type { SchemaSummary } from '@/models/schema'
import { readScheme } from '@/utils/scheme'

const { industries, schemas, schemaDetails, loading, load } = useRegister()
const { reportError } = useSnackbar()
const { t } = useLanguage()

const search = ref<string>('')
const createOpen = ref<boolean>(false)

const matched = computed<SchemaSummary[]>(() => {
  const needle = search.value.trim().toLowerCase()
  if (needle.length === 0) {
    return schemas.value
  }

  return schemas.value.filter(
    (schema) => schema.name.toLowerCase().includes(needle) || schema.creator.toLowerCase().includes(needle),
  )
})

/** The industries a schema is declared for; a global schema, and one that names none, belongs to all of them. */
const industriesOf = (schemaId: string): Industry[] =>
  isGlobal(schemaId) ? [] : (schemaDetails.value.get(schemaId)?.industries ?? [])

/** Whether a schema is shared by every industry and every table. */
const isGlobal = (schemaId: string): boolean => schemaDetails.value.get(schemaId)?.global === true

/** How many attributes a schema declares, out of the declaration already read for the register. */
const fieldCount = (schemaId: string): number => readScheme(schemaDetails.value.get(schemaId)?.scheme).fields.length

/* One of them is said as one rather than as "1 attributes", in either language. */
const attributeCount = (schemaId: string): string => {
  const count = fieldCount(schemaId)

  return count === 1 ? t('schemas.attributeCountOne') : t('schemas.attributeCount', { count })
}

const onCreated = async () => {
  try {
    await load(true)
  } catch (error) {
    reportError(error)
  }
}
</script>

<style scoped>
/*
 * This page turns around with the language, unlike the register behind it.
 *
 * Everywhere else the page keeps its arrangement in both languages and only the table inside it runs the
 * other way. Here there is no table: the page is its own heading, a search box and a wall of cards, all of
 * it read rather than operated, and a heading standing on the left above a line of Hebrew standing on the
 * right reads as a mistake rather than as a layout. The header above it does not move, and neither does
 * anything a card holds that is the register's own - a schema named in English still reads from the left.
 */
html[lang='he'] .schemas {
  direction: rtl;
}

/*
 * Vuetify takes the direction of its own inputs from its locale, which neither language mirrors, so the
 * search box has to be told or it alone keeps its magnifier and its text on the other side of the page.
 */
html[lang='he'] .schemas .schemas__search {
  direction: rtl;
}

.schemas__heading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.schemas__title {
  font-size: 1.75rem;
  font-weight: 600;
}

.schemas__note,
.schemas__empty,
.schemas__meta {
  color: rgb(var(--v-theme-app-muted));
  font-size: 0.875rem;
}

/*
 * Vuetify gives every input `flex: 1 1 auto`, which is what makes one fill the row it shares with others.
 * Laid straight into a column that rule fills the leftover *height* of the page instead: the box grew to
 * several hundred pixels while the text stayed at the top of it and the search icon floated in the middle.
 * The field is pinned to its own height, and keeps its ceiling on the width.
 */
.schemas__search {
  flex: 0 0 auto;
  max-inline-size: 32rem;
}

.schemas__empty,
.schemas__loading {
  display: flex;
  justify-content: center;
  padding-block: 3rem;
}

.schemas__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: 1rem;
}

.schemas__card {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 1rem 1.25rem;
  background-color: rgb(var(--v-theme-surface));
}

.schemas__card-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.schemas__revision {
  margin-inline-start: auto;
  font-size: 0.75rem;
  opacity: 0.7;
  white-space: nowrap;
}

.schemas__industries {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.schemas__card-title {
  font-size: 1rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
</style>
