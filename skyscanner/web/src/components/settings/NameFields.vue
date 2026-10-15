<script setup lang="ts">
/** "Name in English" (ltr) and "Name in Hebrew" (rtl); at least one is needed. English stays left of Hebrew. */
import { Field, Input, hasAName, translate as t } from '@truth-platform/ui'
import { computed } from 'vue'

const props = defineProps<{ showErrors?: boolean; autofocus?: boolean; idPrefix?: string }>()
const english = defineModel<string>('english', { default: '' })
const hebrew = defineModel<string>('hebrew', { default: '' })
const missing = computed(() => !!props.showErrors && !hasAName({ english: english.value, hebrew: hebrew.value }))
const p = computed(() => props.idPrefix ?? 'name')
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2" dir="ltr">
    <Field :label="t('names.english')" :for="`${p}-en`" :error="missing ? t('names.required') : null">
      <Input :id="`${p}-en`" v-model="english" dir="ltr" :autofocus="autofocus" :invalid="missing" />
    </Field>
    <Field :label="t('names.hebrew')" :for="`${p}-he`" :error="missing ? t('names.required') : null" class="text-right [&_label]:text-right" dir="rtl">
      <Input :id="`${p}-he`" v-model="hebrew" dir="rtl" :invalid="missing" />
    </Field>
  </div>
</template>
