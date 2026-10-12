<template>
  <!--
    The chip lies in the direction of the table it is in, so its icon is always at the same end of it; the
    label inside takes the direction of its own value, so a Hebrew tag reads right to left inside an English
    table and an English one left to right inside a Hebrew table.
  -->
  <span
    class="sky-chip"
    :class="{ 'sky-chip--solid': solid, 'sky-chip--neutral': isNeutral }"
    :style="chipStyle"
  ><v-icon
    v-if="icon.length > 0"
    class="sky-chip__icon"
    :icon="icon"
    size="16"
  /><!--
    A chip reads out its label itself, and a caller that has to say something about the label rather than
    only what it says - a run of it the search matched, painted inside the chip instead of over the whole of
    it - fills the slot with the label it built. Leaving the slot alone is what every other caller does.
  --><span
    class="sky-chip__label"
    dir="auto"
  ><slot>{{ label }}</slot></span></span>
</template>

<script lang="ts">
interface Props {
  /** What the chip reads out, and what it falls back to whenever the slot is left alone. */
  label: string
  token: string
  solid?: boolean
  /** An icon drawn before the label, for a value that is recognised by one. */
  icon?: string
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'

import { NEUTRAL_TOKEN } from '../utils/palette'

const props = withDefaults(defineProps<Props>(), { solid: false, icon: '' })

const theme = useTheme()

const isNeutral = computed<boolean>(() => props.token === NEUTRAL_TOKEN)

const chipStyle = computed<Record<string, string>>(() => {
  /* A neutral chip carries no colour in either theme; its look is written in the stylesheet below. */
  if (isNeutral.value) {
    const none: Record<string, string> = {}

    return none
  }

  const variable = `var(--v-theme-${props.token})`
  const isDark = theme.current.value.dark

  if (props.solid || !isDark) {
    return {
      backgroundColor: `rgb(${variable})`,
      color: '#FFFFFF',
      borderColor: `rgba(${variable}, 0.6)`,
    }
  }

  return {
    backgroundColor: `rgba(${variable}, 0.18)`,
    color: `rgb(${variable})`,
    borderColor: `rgba(${variable}, 0.35)`,
  }
})
</script>

<style scoped>
.sky-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3125rem;
  border: 0.0625rem solid transparent;
  border-radius: 0.375rem;
  padding-inline: 0.625rem;
  padding-block: 0.1875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.25;
  white-space: nowrap;
  max-inline-size: 100%;
  overflow: hidden;
}

.sky-chip__label {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sky-chip__icon {
  flex: 0 0 auto;
  opacity: 0.9;
}

.sky-chip--solid {
  font-weight: 600;
}

.sky-chip--neutral {
  background-color: rgba(var(--v-theme-on-surface), 0.07);
  border-color: rgba(var(--v-theme-on-surface), 0.2);
  color: rgba(var(--v-theme-on-surface), 0.92);
}
</style>
