<template>
  <RouterLink :to="`/schemas/${schema.id}`" class="schema-card surface">
    <header class="schema-card__head">
      <div class="schema-card__icon" :style="{ color: `rgb(var(--v-theme-${chipColor(schema.name)}))`, background: `rgba(var(--v-theme-${chipColor(schema.name)}), 0.14)` }">
        <v-icon icon="mdi-shape-outline" size="20" />
      </div>
      <div class="schema-card__titles">
        <h3 class="schema-card__name bidi">{{ schema.name }}</h3>
        <span class="schema-card__meta">{{ t('schemas.revision', { number: schema.revision }) }} · {{ formatRelative(schema.created_at) }}</span>
      </div>
    </header>

    <p v-if="detail?.description" class="schema-card__description bidi">{{ detail.description }}</p>

    <div class="schema-card__fields">
      <ValueChip v-for="field in shownFields" :key="field.key" :label="fieldLabel(field, language)" variant="dot" :color="chipColor(schema.name)" />
      <span v-if="fields.length > shownFields.length" class="schema-card__more">+{{ fields.length - shownFields.length }}</span>
    </div>

    <footer class="schema-card__foot">
      <span class="schema-card__fact">
        <v-icon icon="mdi-format-list-bulleted" size="15" />
        {{ fields.length === 1 ? t('schemas.attributeCountOne') : t('schemas.attributeCount', { count: fields.length }) }}
      </span>
      <span class="schema-card__fact">
        <v-icon icon="mdi-lightbulb-on-outline" size="15" />
        {{ t('schemas.usedByCount', { count: usage }) }}
      </span>
      <v-spacer />
      <div class="schema-card__industries">
        <template v-if="detail && appliesEverywhere(detail)">
          <ValueChip :label="t('schemas.allIndustries')" neutral variant="outline" />
        </template>
        <ValueChip v-for="industry in detail?.industries ?? []" v-else :key="industry.id" :label="industry.name" />
      </div>
    </footer>
  </RouterLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { SchemaDetail, SchemaSummary } from '@/domain/models'
import { appliesEverywhere } from '@/domain/models'
import { fieldLabel, readScheme } from '@/domain/scheme'
import { useI18n } from '@/i18n'
import ValueChip from '@/shared/components/ValueChip.vue'
import { chipColor } from '@/shared/utils/colors'
import { formatRelative } from '@/shared/utils/format'

const SHOWN_FIELDS = 6

const props = defineProps<{ schema: SchemaSummary; detail: SchemaDetail | undefined; usage: number }>()

const { t, language } = useI18n()

const fields = computed(() => readScheme(props.detail?.scheme))
const shownFields = computed(() => fields.value.slice(0, SHOWN_FIELDS))
</script>

<style scoped>
.schema-card {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1.15rem 1.2rem;
  color: inherit;
  text-decoration: none;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}

.schema-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.5);
  transform: translateY(-2px);
  box-shadow: var(--truth-shadow);
}

.schema-card__head {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.schema-card__icon {
  display: grid;
  place-items: center;
  inline-size: 2.4rem;
  block-size: 2.4rem;
  border-radius: 11px;
  flex: none;
}

.schema-card__titles {
  min-inline-size: 0;
}

.schema-card__name {
  font-size: 1rem;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schema-card__meta {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-muted));
}

.schema-card__description {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.schema-card__fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.schema-card__more {
  align-self: center;
  font-size: 0.75rem;
  color: rgb(var(--v-theme-muted));
}

.schema-card__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  margin-block-start: auto;
  padding-block-start: 0.8rem;
  border-top: 1px solid rgb(var(--v-theme-border));
}

.schema-card__fact {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: rgb(var(--v-theme-muted));
}

.schema-card__industries {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
</style>
