<script setup lang="ts">
/**
 * The key: English letters, digits and `_`, unique. In edit mode it is locked behind CHANGE (when `renamable`),
 * which unlocks it and shows what saving under a new key would rewrite.
 */
import { Info, PencilLine } from 'lucide-vue-next'
import { Button, Field, Input, Spinner, isValidKey, translate as t } from '@truth-platform/ui'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    taken?: string[]
    /** Edit mode: locked until unlocked. */
    locked?: boolean
    /** Offer CHANGE while locked. */
    renamable?: boolean
    summary?: string
    checking?: boolean
    showErrors?: boolean
    id?: string
  }>(),
  { taken: () => [], id: 'key' },
)
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ unlock: [] }>()

const error = computed(() => {
  const key = model.value.trim()
  if (props.locked) return null
  if (!key) return props.showErrors ? t('names.keyEnglish') : null
  if (!isValidKey(key)) return t('names.keyEnglish')
  if (props.taken.includes(key)) return t('names.keyTaken')
  return null
})
</script>

<template>
  <Field :label="t('names.key')" :for="id" :error="error">
    <div class="flex items-center gap-2">
      <Input
        :id="id"
        v-model="model"
        dir="ltr"
        class="mono"
        spellcheck="false"
        autocomplete="off"
        :disabled="locked"
        :invalid="!!error"
      />
      <Button v-if="locked && renamable" variant="secondary" @click="emit('unlock')"><PencilLine /> {{ t('rename.change') }}</Button>
    </div>
    <div v-if="checking || summary" class="mt-1 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft/60 px-3 py-2 text-xs text-warning-foreground">
      <Spinner v-if="checking" class="size-3.5" />
      <Info v-else class="mt-px size-3.5 shrink-0" />
      <span dir="auto">{{ summary }}</span>
    </div>
  </Field>
</template>
