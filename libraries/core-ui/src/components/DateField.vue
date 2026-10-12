<template>
  <!--
    The browser's own date input, which keeps its calendar and its typing on every browser this runs in.

    What it draws while it is empty is not the page's to choose: it spells out the order of the day, the month
    and the year in the language of the browser, so a Hebrew page showed "mm/dd/yyyy". While the box is empty
    and nobody is typing into it, that is hidden and the page's own placeholder is shown in its place.
  -->
  <v-text-field
    class="ui-date-field"
    :class="{ 'ui-date-field--labelled': label !== undefined && label.length > 0 }"
    :style="{ '--ui-date-placeholder': placeholderValue }"
    :model-value="modelValue"
    :type="withTime ? 'datetime-local' : 'date'"
    :label="label"
    :rules="rules"
    :density="density"
    :hide-details="hideDetails"
    :clearable="clearable"
    :disabled="disabled"
    @update:model-value="emit('update:modelValue', $event ?? '')"
  />
</template>

<script lang="ts">
type ValidationRule = (value: string | null) => true | string

interface Props {
  /** The day as the input writes it, `YYYY-MM-DD` (or with a time), or empty while nothing is picked. */
  modelValue: string
  label?: string
  /** What the empty box says; the page's own "pick a date" when nobody says anything else. */
  placeholder?: string
  withTime?: boolean
  rules?: ValidationRule[]
  density?: 'default' | 'comfortable' | 'compact'
  hideDetails?: boolean | 'auto'
  clearable?: boolean
  disabled?: boolean
}

interface Emits {
  (event: 'update:modelValue', value: string): void
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { useLanguage } from '../composables/useLanguage'

const props = withDefaults(defineProps<Props>(), {
  label: undefined,
  placeholder: '',
  withTime: false,
  rules: () => [],
  density: undefined,
  hideDetails: 'auto',
  clearable: false,
  disabled: false,
})
const emit = defineEmits<Emits>()

const { t } = useLanguage()

/* Handed to the stylesheet as a quoted string, which is the only shape `content` takes a variable in. */
const placeholderValue = computed<string>(() =>
  JSON.stringify(props.placeholder.length > 0 ? props.placeholder : t('input.pickDate')),
)
</script>

<style>
/*
 * Unscoped: the parts being styled belong to Vuetify and to the browser, not to this component.
 *
 * Vuetify lays its inputs out as flex boxes, which shrinks the browser's own date editor to its text and leaves
 * the calendar button in the middle of the box, right on top of the placeholder. As a block the editor fills
 * the box again and the button stands at its end.
 */
.ui-date-field input.v-field__input {
  display: block;
}

.ui-date-field .v-field:not(.v-field--dirty):not(.v-field--focused) input::-webkit-datetime-edit {
  color: transparent;
}

.ui-date-field .v-field:not(.v-field--dirty):not(.v-field--focused) .v-field__field::after {
  content: var(--ui-date-placeholder);
  position: absolute;
  /* Level with the input, which keeps its own height when a taller field beside it stretches the row. */
  top: calc(var(--v-input-control-height, 3.5rem) / 2);
  left: var(--v-field-padding-start);
  right: 2.5rem;
  transform: translateY(-50%);
  opacity: var(--v-medium-emphasis-opacity);
  pointer-events: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  unicode-bidi: plaintext;
  text-align: start;
}

/* A field with a label already says what it asks for, and the label stands where the placeholder would. */
.ui-date-field--labelled .v-field .v-field__field::after {
  content: none;
}
</style>
