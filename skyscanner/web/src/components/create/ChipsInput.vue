<script setup lang="ts">
/**
 * Free values as chips: type, then Enter (or a comma) adds. Numeric lists parse each value (`integer` wants
 * whole numbers); a value that is not a number is refused and said so.
 */
import { X } from 'lucide-vue-next'
import { cn, translate as t } from '@truth-platform/ui'
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    numeric?: 'number' | 'integer' | null
    placeholder?: string
    hint?: string | null
    invalid?: boolean
    disabled?: boolean
    id?: string
    dir?: 'ltr' | 'rtl' | 'auto'
  }>(),
  { numeric: null, hint: undefined, dir: 'auto' },
)
const model = defineModel<(string | number)[]>({ default: () => [] })

const text = ref('')
const refused = ref(false)

function read(raw: string): string | number | undefined {
  const v = raw.trim()
  if (!v) return undefined
  if (!props.numeric) return v
  const n = Number(v)
  if (!Number.isFinite(n) || (props.numeric === 'integer' && !Number.isInteger(n))) return undefined
  return n
}

function commit() {
  const pieces = text.value.split(',').map((p) => p.trim()).filter(Boolean)
  if (!pieces.length) return
  const kept: (string | number)[] = []
  let bad = false
  for (const p of pieces) {
    const v = read(p)
    if (v === undefined) bad = true
    else if (!model.value.includes(v) && !kept.includes(v)) kept.push(v)
  }
  refused.value = bad
  if (kept.length) model.value = [...model.value, ...kept]
  text.value = bad ? pieces.filter((p) => read(p) === undefined).join(', ') : ''
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    commit()
  } else if (e.key === 'Backspace' && !text.value && model.value.length) {
    model.value = model.value.slice(0, -1)
  }
}

function remove(i: number) {
  model.value = model.value.filter((_, j) => j !== i)
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div
      :class="cn(
        'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-2 py-1 text-sm transition-colors',
        'focus-within:border-primary focus-within:ring-[3px] focus-within:ring-ring',
        (invalid || refused) && 'border-danger',
        disabled && 'opacity-60',
      )"
    >
      <span
        v-for="(v, i) in model"
        :key="`${i}-${v}`"
        class="inline-flex max-w-full items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-xs"
      >
        <span class="truncate" :dir="dir">{{ v }}</span>
        <button
          v-if="!disabled"
          type="button"
          class="text-muted-foreground hover:text-foreground"
          :aria-label="t('common.remove')"
          @click="remove(i)"
        >
          <X class="size-3" />
        </button>
      </span>
      <input
        :id="id"
        v-model="text"
        :dir="dir"
        :disabled="disabled"
        :inputmode="numeric ? 'decimal' : undefined"
        :placeholder="model.length ? '' : placeholder"
        class="h-7 min-w-24 flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground/70"
        @keydown="onKey"
        @blur="commit"
      />
    </div>
    <p v-if="refused" class="text-xs text-danger">{{ t('input.numbersOnly') }}</p>
    <p v-else-if="hint !== null" class="text-xs text-muted-foreground">{{ hint ?? t('input.pressEnter') }}</p>
  </div>
</template>
