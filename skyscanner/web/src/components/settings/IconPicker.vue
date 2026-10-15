<script lang="ts">
export const SUGGESTED_ICONS = [
  'domain', 'factory', 'airplane', 'helicopter', 'quadcopter', 'parachute', 'rocket-launch', 'satellite-variant', 'radar',
  'antenna', 'radio-tower', 'telescope', 'ferry', 'ship-wheel', 'submarine', 'car', 'truck', 'bus', 'train', 'tank',
  'fire-truck', 'tractor', 'excavator', 'lightning-bolt', 'solar-power', 'wind-turbine', 'oil', 'gas-cylinder', 'pipe',
  'water', 'leaf', 'sprout', 'hospital-building', 'flask', 'microscope', 'atom', 'chip', 'server', 'cloud', 'cellphone',
  'shield-airplane', 'bank', 'cart', 'package-variant', 'warehouse', 'hammer-wrench', 'robot-industrial',
  'account-hard-hat', 'earth', 'map-marker', 'weather-cloudy', 'school', 'office-building', 'city',
].map((n) => `mdi-${n}`)
</script>

<script setup lang="ts">
/** An icon: typed as an mdi name (`mdi-airplane`) or picked from the suggestions. */
import { Field, Input, cn, translate as t } from '@truth-platform/ui'
import { computed } from 'vue'
import { KNOWN_ICON_NAMES } from '@/lib/icons'
import MdiIcon from './MdiIcon.vue'



const ICON_PATTERN = /^mdi-[a-z0-9]+(-[a-z0-9]+)*$/

const props = defineProps<{ id?: string; extra?: string[] }>()
const model = defineModel<string>({ default: '' })
const valid = computed(() => ICON_PATTERN.test(model.value.trim()))
const offered = computed(() => [...new Set([...SUGGESTED_ICONS, ...(props.extra ?? []).filter((n) => KNOWN_ICON_NAMES.includes(n))])])
</script>

<template>
  <Field :label="t('icons.label')" :for="id ?? 'icon'" :error="model.trim() && !valid ? t('icons.invalid') : null">
    <div class="flex items-center gap-3">
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
        <MdiIcon :name="valid ? model.trim() : 'mdi-domain'" :size="22" />
      </span>
      <Input :id="id ?? 'icon'" :model-value="model" dir="ltr" class="mono" :invalid="!!model.trim() && !valid" @update:model-value="(v) => (model = String(v ?? '').trim())" />
    </div>
    <div role="listbox" :aria-label="t('icons.label')" class="mt-2 grid max-h-40 grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1 overflow-y-auto rounded-xl border border-border p-1.5">
      <button
        v-for="name in offered"
        :key="name"
        type="button"
        role="option"
        :aria-selected="model === name"
        :title="name"
        :class="cn(
          'grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          model === name && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
        )"
        @click="model = name"
      >
        <MdiIcon :name="name" :size="18" />
      </button>
    </div>
  </Field>
</template>
