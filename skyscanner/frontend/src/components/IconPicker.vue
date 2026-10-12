<template>
  <!--
    The icon an industry is drawn with: a grid of the ones that suit an industry, and a box for any other
    Material Design icon by name. The picked one is shown large beside its name.
  -->
  <div class="icon-picker">
    <div class="icon-picker__head">
      <span class="icon-picker__preview">
        <v-icon
          :icon="current"
          size="28"
        />
      </span>
      <v-text-field
        class="icon-picker__name"
        :model-value="modelValue"
        :label="t('icons.label')"
        dir="ltr"
        spellcheck="false"
        :error-messages="isValid ? undefined : t('icons.invalid')"
        @update:model-value="emit('update:modelValue', ($event ?? '').trim())"
      />
    </div>

    <div
      class="icon-picker__grid"
      role="listbox"
      :aria-label="t('icons.label')"
    >
      <button
        v-for="icon in INDUSTRY_ICONS"
        :key="icon"
        type="button"
        role="option"
        class="icon-picker__option"
        :class="{ 'icon-picker__option--active': icon === modelValue }"
        :aria-selected="icon === modelValue"
        :title="icon"
        @click="emit('update:modelValue', icon)"
      >
        <v-icon
          :icon="icon"
          size="22"
        />
      </button>
    </div>
  </div>
</template>

<script lang="ts">
interface Props {
  modelValue: string
}

interface Emits {
  (event: 'update:modelValue', value: string): void
}

/** The icons offered at a glance, which between them cover the industries the inventory is used for. */
const INDUSTRY_ICONS: string[] = [
  'mdi-domain',
  'mdi-factory',
  'mdi-airplane',
  'mdi-helicopter',
  'mdi-quadcopter',
  'mdi-parachute',
  'mdi-rocket-launch',
  'mdi-satellite-variant',
  'mdi-radar',
  'mdi-antenna',
  'mdi-radio-tower',
  'mdi-telescope',
  'mdi-ferry',
  'mdi-ship-wheel',
  'mdi-submarine',
  'mdi-car',
  'mdi-truck',
  'mdi-bus',
  'mdi-train',
  'mdi-tank',
  'mdi-fire-truck',
  'mdi-tractor',
  'mdi-excavator',
  'mdi-lightning-bolt',
  'mdi-solar-power',
  'mdi-wind-turbine',
  'mdi-oil',
  'mdi-gas-cylinder',
  'mdi-pipe',
  'mdi-water',
  'mdi-leaf',
  'mdi-sprout',
  'mdi-hospital-building',
  'mdi-flask',
  'mdi-microscope',
  'mdi-atom',
  'mdi-chip',
  'mdi-server',
  'mdi-cloud',
  'mdi-cellphone',
  'mdi-shield-airplane',
  'mdi-bank',
  'mdi-cart',
  'mdi-package-variant',
  'mdi-warehouse',
  'mdi-hammer-wrench',
  'mdi-robot-industrial',
  'mdi-account-hard-hat',
  'mdi-earth',
  'mdi-map-marker',
  'mdi-weather-cloudy',
  'mdi-school',
  'mdi-office-building',
  'mdi-city',
]

/** What an icon name looks like: the family prefix and a name of lower case words. */
const ICON_PATTERN = /^mdi-[a-z0-9]+(-[a-z0-9]+)*$/

/** What is drawn while the typed name is not an icon yet. */
const FALLBACK_ICON = 'mdi-domain'
</script>

<script setup lang="ts">
import { useLanguage } from '@truth-platform/core-ui'
import { computed } from 'vue'

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useLanguage()

const isValid = computed<boolean>(() => ICON_PATTERN.test(props.modelValue))

const current = computed<string>(() => (isValid.value ? props.modelValue : FALLBACK_ICON))
</script>

<style scoped>
.icon-picker {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.icon-picker__head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.icon-picker__preview {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  inline-size: 3rem;
  block-size: 3rem;
  border: 0.0625rem solid rgb(var(--v-theme-control-border));
  border-radius: 0.75rem;
}

.icon-picker__name {
  flex: 1 1 auto;
}

.icon-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2.5rem, 1fr));
  gap: 0.25rem;
  max-block-size: 9.5rem;
  overflow-y: auto;
  padding: 0.25rem;
  border: 0.0625rem solid rgb(var(--v-theme-control-border));
  border-radius: 0.5rem;
}

.icon-picker__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  block-size: 2.5rem;
  border: 0.0625rem solid transparent;
  border-radius: 0.5rem;
  background: none;
  color: rgb(var(--v-theme-on-surface));
  cursor: pointer;
}

.icon-picker__option:hover {
  background-color: rgb(var(--v-theme-control-surface-hover));
}

.icon-picker__option--active {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
}
</style>
