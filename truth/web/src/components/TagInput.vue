<script setup lang="ts">
/**
 * Free values as chips: type one and press Enter (or leave the box) to add it; known values are suggested.
 * Backspace in an empty box takes the last chip back.
 */
import { X } from 'lucide-vue-next'
import { cn, fieldClass, newLocalId, translate as t } from '@truth-platform/ui'
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{ suggestions?: string[]; placeholder?: string; invalid?: boolean; inputType?: string; disabled?: boolean; id?: string }>(),
  { suggestions: () => [], inputType: 'text' },
)
const model = defineModel<string[]>({ default: () => [] })
const text = ref('')
const listId = `tags-${newLocalId()}`
const offered = computed(() => props.suggestions.filter((s) => !model.value.includes(s)))

function commit() {
  const v = text.value.trim()
  if (v && !model.value.includes(v)) model.value = [...model.value, v]
  text.value = ''
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commit()
  } else if (e.key === 'Backspace' && !text.value && model.value.length) {
    model.value = model.value.slice(0, -1)
  }
}
const remove = (v: string) => (model.value = model.value.filter((x) => x !== v))
</script>

<template>
  <div
    :class="cn(fieldClass, 'flex min-h-9 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring')"
    :aria-invalid="invalid || undefined"
  >
    <span v-for="v in model" :key="v" class="inline-flex max-w-full items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-xs">
      <span class="truncate" dir="auto">{{ v }}</span>
      <button v-if="!disabled" type="button" class="text-muted-foreground hover:text-foreground" :aria-label="t('files.remove', { name: v })" @click="remove(v)">
        <X class="size-3" />
      </button>
    </span>
    <input
      :id="id"
      v-model="text"
      :type="inputType"
      :list="offered.length ? listId : undefined"
      :disabled="disabled"
      :placeholder="model.length ? '' : (placeholder ?? t('input.pressEnter'))"
      :dir="inputType === 'text' ? 'auto' : 'ltr'"
      class="min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground/70"
      @keydown="onKey"
      @blur="commit"
    />
    <datalist v-if="offered.length" :id="listId">
      <option v-for="s in offered" :key="s" :value="s" />
    </datalist>
  </div>
</template>
