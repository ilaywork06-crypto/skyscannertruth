<template>
  <div class="attrs surface">
    <table class="attrs__table">
      <thead>
        <tr>
          <th>{{ t('assumption.attribute') }}</th>
          <th>{{ t('builder.key') }}</th>
          <th>{{ t('builder.type') }}</th>
          <th>{{ t('schemas.rules') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="field in fields" :key="field.key">
          <td>
            <div class="attrs__name bidi">{{ fieldLabel(field, language) }}</div>
            <div v-if="secondaryName(field)" class="attrs__secondary bidi">{{ secondaryName(field) }}</div>
          </td>
          <td><code dir="ltr">{{ field.key }}</code></td>
          <td>
            <ValueChip :label="typeLabel(field.type) + (field.array ? ' []' : '')" neutral variant="dot" />
          </td>
          <td>
            <div class="attrs__rules">
              <ValueChip v-if="field.required" :label="t('builder.required')" color="warning" />
              <ValueChip v-for="option in field.options" :key="option" :label="option" variant="outline" />
              <span v-if="bounds(field)" class="attrs__bounds tabular" dir="ltr">{{ bounds(field) }}</span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { SchemeField } from '@/domain/scheme'
import { fieldLabel, typeLabel } from '@/domain/scheme'
import { describeBounds } from '@/domain/validation'
import { useI18n } from '@/i18n'
import ValueChip from '@/shared/components/ValueChip.vue'

defineProps<{ fields: SchemeField[] }>()

const { t, language } = useI18n()

/** The name in the other language, when the field has both. */
const secondaryName = (field: SchemeField): string => {
  if (!field.displayNameHebrew || field.displayNameHebrew === field.displayName) return ''

  return language.value === 'he' ? field.displayName : field.displayNameHebrew
}

const bounds = (field: SchemeField): string =>
  describeBounds(field)
    .map((part) => t(part.message, part.params))
    .join(' · ')
</script>

<style scoped>
.attrs {
  overflow-x: auto;
}

.attrs__table {
  inline-size: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.attrs__table th {
  padding: 0.7rem 1rem;
  background: rgb(var(--v-theme-header-row));
  border-block-end: 1px solid rgb(var(--v-theme-border));
  text-align: start;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-muted));
}

.attrs__table td {
  padding: 0.75rem 1rem;
  border-block-end: 1px solid rgb(var(--v-theme-border));
  vertical-align: top;
}

.attrs__table tr:last-child td {
  border-block-end: none;
}

.attrs__name {
  font-weight: 600;
}

.attrs__secondary {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-muted));
}

code {
  padding: 0.1rem 0.4rem;
  border-radius: 6px;
  background: rgb(var(--v-theme-surface-light));
  font-size: 0.78rem;
}

.attrs__rules {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}

.attrs__bounds {
  font-size: 0.78rem;
  color: rgb(var(--v-theme-muted));
}
</style>
