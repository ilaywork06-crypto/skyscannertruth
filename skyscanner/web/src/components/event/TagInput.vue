<script setup lang="ts">
/** Free values as chips: type one, press Enter (or a comma) to add it; ✕ removes. Anything left typed is not kept. */
import { X } from 'lucide-vue-next'
import { cn, fieldClass, translate as t } from '@truth-platform/ui'
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  id?: string
  ltr?: boolean
  /** A caller may refuse an item (answers false) - e.g. a number field refusing words. */
  accept?: (value: string) => boolean
}>(), {
  placeholder: '',
  invalid: false,
  disabled: false,
})
const model = defineModel<string[]>({ default: () => [] })
const emit = defineEmits<{ rejected: [text: string] }>()
const draft = ref('')
const input = ref<HTMLInputElement>()

function add() {
  const v = draft.value.trim()
  if (!v) return
  if (props.accept && !props.accept(v)) {
    emit('rejected', v)
    return
  }
  if (!model.value.includes(v)) model.value = [...model.value, v]
  draft.value = ''
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    add()
  } else if (e.key === 'Backspace' && !draft.value && model.value.length) {
    model.value = model.value.slice(0, -1)
  }
}
</script>

<template>
  <div
    :class="cn(fieldClass, 'flex min-h-9 flex-wrap items-center gap-1 px-2 py-1', invalid && 'border-danger', disabled && 'opacity-60')"
    @click="input?.focus()"
  >
    <span v-for="v in model" :key="v" class="inline-flex max-w-full items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-xs">
      <span class="truncate" :dir="ltr ? 'ltr' : 'auto'">{{ v }}</span>
      <button v-if="!disabled" type="button" class="text-muted-foreground hover:text-foreground" :aria-label="t('files.remove', { name: v })" @click.stop="model = model.filter((x) => x !== v)">
        <X class="size-3" />
      </button>
    </span>
    <input
      :id="id"
      ref="input"
      v-model="draft"
      :disabled="disabled"
      :placeholder="model.length ? '' : placeholder"
      :dir="ltr ? 'ltr' : 'auto'"
      class="h-7 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
      @keydown="onKey"
      @blur="add"
    />
  </div>
</template>
