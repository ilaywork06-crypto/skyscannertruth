<template>
  <!-- A key is stored exactly as written, so it is written in English and read left to right. -->
  <v-text-field
    class="key-field ui-field--ltr"
    :model-value="modelValue"
    :label="label.length > 0 ? label : t('names.key')"
    :disabled="disabled"
    :hint="hint"
    :persistent-hint="hint !== undefined && hint.length > 0"
    :error-messages="problem"
    dir="ltr"
    spellcheck="false"
    autocomplete="off"
    @update:model-value="emit('update:modelValue', $event ?? '')"
  >
    <template
      v-if="$slots.append"
      #append-inner
    >
      <slot name="append" />
    </template>
  </v-text-field>
</template>

<script lang="ts">
interface Props {
  modelValue: string
  label?: string
  hint?: string
  disabled?: boolean
  /** Keys already taken, which this one may not repeat. */
  taken?: string[]
}

interface Emits {
  (event: 'update:modelValue', value: string): void
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { useLanguage } from '../composables/useLanguage'
import { isValidKey } from '../utils/format'

const props = withDefaults(defineProps<Props>(), { label: '', hint: undefined, disabled: false, taken: () => [] })
const emit = defineEmits<Emits>()

const { t } = useLanguage()

const problem = computed<string | undefined>(() => {
  const key = props.modelValue.trim()
  if (key.length === 0 || props.disabled) {
    return undefined
  }

  if (!isValidKey(key)) {
    return t('names.keyEnglish')
  }

  return props.taken.includes(key) ? t('names.keyTaken') : undefined
})
</script>

<style scoped>
.key-field :deep(input) {
  font-family: ui-monospace, 'SFMono-Regular', 'Consolas', monospace;
}
</style>
