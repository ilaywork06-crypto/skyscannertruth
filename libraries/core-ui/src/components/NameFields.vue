<template>
  <!--
    Every declaration is named in English and in Hebrew, and at least one of the two has to be written. Each
    field runs in the direction of its own language whatever the page is set to.
  -->
  <div class="name-fields">
    <v-text-field
      class="ui-field--ltr"
      :model-value="english"
      :label="t('names.english')"
      dir="ltr"
      :error-messages="missing ? t('names.required') : undefined"
      :autofocus="autofocus"
      @update:model-value="onEnglish"
    />
    <v-text-field
      class="ui-field--rtl"
      :model-value="hebrew"
      :label="t('names.hebrew')"
      dir="rtl"
      :error-messages="missing ? t('names.required') : undefined"
      @update:model-value="emit('update:hebrew', $event ?? '')"
    />
  </div>
</template>

<script lang="ts">
interface Props {
  english: string
  hebrew: string
  /** Whether to say that a name is missing, which a form only does once somebody tried to save it. */
  showErrors?: boolean
  autofocus?: boolean
}

interface Emits {
  (event: 'update:english', value: string): void
  (event: 'update:hebrew', value: string): void
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { useLanguage } from '../composables/useLanguage'

const props = withDefaults(defineProps<Props>(), { showErrors: false, autofocus: false })
const emit = defineEmits<Emits>()

const { t } = useLanguage()

const missing = computed<boolean>(
  () => props.showErrors && props.english.trim().length === 0 && props.hebrew.trim().length === 0,
)

const onEnglish = (value: string | null) => {
  emit('update:english', value ?? '')
}
</script>

<style scoped>
/*
 * The English name stands to the left of the Hebrew one whatever the page or the dialog around them runs.
 * Each is written in its own language, so their sides are a property of the pair rather than of the page -
 * and a form that swapped them in Hebrew would put each name on the side of the other language.
 */
.name-fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem;
  direction: ltr;
}
</style>
