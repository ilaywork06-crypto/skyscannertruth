<template>
  <div class="quick">
    <span class="quick__label"><v-icon icon="mdi-lightning-bolt-outline" size="15" />{{ t('register.quickFilters') }}</span>

    <v-menu v-for="column in columns" :key="column.id" :close-on-content-click="false" location="bottom start" offset="6">
      <template #activator="{ props: activator }">
        <button v-bind="activator" type="button" class="quick__pill" :class="{ 'quick__pill--active': selected(column.id).length > 0 }">
          <span class="bidi">{{ column.label }}</span>
          <span v-if="selected(column.id).length > 0" class="quick__count">{{ selected(column.id).length }}</span>
          <v-icon icon="mdi-chevron-down" size="15" />
        </button>
      </template>

      <v-card width="260" class="quick__menu">
        <div class="quick__options">
          <p v-if="optionsFor(column.id).length === 0" class="quick__none">{{ t('filter.noValues') }}</p>
          <button
            v-for="option in optionsFor(column.id)"
            :key="option.value"
            type="button"
            class="quick__option"
            :class="{ 'quick__option--on': selected(column.id).includes(option.value) }"
            @click="toggle(column.id, option.value)"
          >
            <v-icon :icon="selected(column.id).includes(option.value) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'" size="18" />
            <span class="quick__value bidi">{{ option.value }}</span>
            <span class="quick__n tabular">{{ option.count }}</span>
          </button>
        </div>
        <div v-if="selected(column.id).length > 0" class="quick__foot">
          <v-btn variant="text" size="small" block @click="emit('change', column.id, [])">{{ t('common.clear') }}</v-btn>
        </div>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import type { ColumnDef } from '@/domain/register/types'
import { useI18n } from '@/i18n'

import type { QuickFilterOption } from '../composables/useRegisterTable'

const props = defineProps<{
  columns: ColumnDef[]
  optionsFor: (columnId: string) => QuickFilterOption[]
  selected: (columnId: string) => string[]
}>()

const emit = defineEmits<{ change: [columnId: string, values: string[]] }>()

const { t } = useI18n()

const toggle = (columnId: string, value: string) => {
  const current = props.selected(columnId)
  emit('change', columnId, current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
}
</script>

<style scoped>
.quick {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.quick__label {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-inline-end: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(var(--v-theme-muted));
}

.quick__pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.55rem 0.3rem 0.75rem;
  border-radius: 999px;
  border: 1px dashed rgb(var(--v-theme-border-strong));
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-on-surface));
  transition: border-color 0.15s, background-color 0.15s;
}

.quick__pill:hover {
  border-color: rgb(var(--v-theme-primary));
}

.quick__pill--active {
  border-style: solid;
  border-color: rgba(var(--v-theme-primary), 0.5);
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}

.quick__count {
  display: grid;
  place-items: center;
  min-inline-size: 1.15rem;
  block-size: 1.15rem;
  padding-inline: 0.3rem;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 0.68rem;
  font-weight: 700;
}

.quick__options {
  display: flex;
  flex-direction: column;
  max-block-size: 18rem;
  overflow-y: auto;
  padding: 0.35rem;
}

.quick__option {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.5rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  text-align: start;
  color: rgb(var(--v-theme-on-surface));
}

.quick__option:hover {
  background: rgb(var(--v-theme-row-hover));
}

.quick__option .v-icon {
  color: rgb(var(--v-theme-muted));
}

.quick__option--on .v-icon {
  color: rgb(var(--v-theme-primary));
}

.quick__value {
  flex: 1;
  min-inline-size: 0;
}

.quick__n {
  font-size: 0.72rem;
  color: rgb(var(--v-theme-muted));
}

.quick__none {
  padding: 0.6rem;
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}

.quick__foot {
  padding: 0.25rem;
  border-top: 1px solid rgb(var(--v-theme-border));
}
</style>
