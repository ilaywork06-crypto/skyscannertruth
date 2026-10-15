<template>
  <span
    class="value-chip"
    :class="[`value-chip--${variant}`, { 'value-chip--clickable': clickable }]"
    :style="{ '--chip': `var(--v-theme-${token})` }"
    :title="label"
  >
    <span v-if="variant === 'dot'" class="value-chip__dot" />
    <span class="value-chip__label bidi">{{ label }}</span>
    <button v-if="closable" type="button" class="value-chip__close" :aria-label="closeLabel" @click.stop="emit('close')">
      <v-icon icon="mdi-close" size="13" />
    </button>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { chipColor } from '@/shared/utils/colors'

const props = withDefaults(
  defineProps<{
    label: string
    /** A theme colour token; defaults to the label's hashed colour. */
    color?: string
    /** `soft` is a tinted pill, `dot` a neutral pill with a coloured dot, `outline` a bordered pill. */
    variant?: 'soft' | 'dot' | 'outline'
    neutral?: boolean
    closable?: boolean
    closeLabel?: string
    clickable?: boolean
  }>(),
  { color: undefined, variant: 'soft', neutral: false, closable: false, closeLabel: '', clickable: false },
)

const emit = defineEmits<{ close: [] }>()

const token = computed(() => (props.neutral ? 'muted' : (props.color ?? chipColor(props.label))))
</script>

<style scoped>
.value-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-inline-size: 100%;
  min-block-size: 1.5rem;
  padding: 0.1rem 0.55rem;
  border-radius: 7px;
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
}

.value-chip--soft {
  background: rgba(var(--chip), 0.14);
  color: rgb(var(--chip));
  box-shadow: inset 0 0 0 1px rgba(var(--chip), 0.22);
}

.value-chip--outline {
  color: rgb(var(--chip));
  box-shadow: inset 0 0 0 1px rgba(var(--chip), 0.55);
}

.value-chip--dot {
  background: rgb(var(--v-theme-surface-light));
  color: rgb(var(--v-theme-on-surface));
  box-shadow: inset 0 0 0 1px rgb(var(--v-theme-border));
}

.value-chip--clickable {
  cursor: pointer;
}

.value-chip__dot {
  inline-size: 0.45rem;
  block-size: 0.45rem;
  border-radius: 50%;
  background: rgb(var(--chip));
  flex: none;
}

.value-chip__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.value-chip__close {
  display: grid;
  place-items: center;
  margin-inline-end: -0.2rem;
  border-radius: 4px;
  color: inherit;
  opacity: 0.7;
}

.value-chip__close:hover {
  opacity: 1;
  background: rgba(var(--chip), 0.2);
}
</style>
