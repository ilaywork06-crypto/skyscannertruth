<script setup lang="ts" generic="V extends string | number">
/**
 * A searchable select, single or multiple. Options are filtered here unless `@search` is listened to, in
 * which case the typed text goes to the caller (server-side search) and the options are shown as given.
 * Closing clears the search, so a reopened list never stays filtered by text that is no longer shown.
 */
import { Check, ChevronsUpDown, Search, X } from 'lucide-vue-next'
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { cn } from '../../lib/cn'
import { translate as t } from '../../i18n'
import { usePreferences } from '../../theme/preferences'

export interface ComboOption<T extends string | number = string> {
  value: T
  label: string
  hint?: string
  group?: string
  disabled?: boolean
  keywords?: string
}

const props = withDefaults(
  defineProps<{
    options: ComboOption<V>[]
    multiple?: boolean
    placeholder?: string
    searchPlaceholder?: string
    empty?: string
    disabled?: boolean
    clearable?: boolean
    loading?: boolean
    invalid?: boolean
    serverSearch?: boolean
    id?: string
    class?: string
  }>(),
  { clearable: true },
)
const model = defineModel<V | V[] | null | undefined>()
const emit = defineEmits<{ search: [text: string] }>()
const { direction } = usePreferences()

const open = ref(false)
const text = ref('')
const input = ref<HTMLInputElement>()
const active = ref(0)

const selected = computed<V[]>(() =>
  props.multiple ? ((model.value as V[] | null) ?? []) : model.value === null || model.value === undefined ? [] : [model.value as V],
)
const labelOf = (v: V) => props.options.find((o) => o.value === v)?.label ?? String(v)

const shown = computed(() => {
  if (props.serverSearch) return props.options
  const q = text.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((o) => `${o.label} ${o.hint ?? ''} ${o.keywords ?? ''} ${o.value}`.toLowerCase().includes(q))
})

watch(text, (v) => {
  active.value = 0
  if (props.serverSearch) emit('search', v)
})
watch(open, async (o) => {
  if (o) {
    await nextTick()
    input.value?.focus()
  } else if (text.value) {
    text.value = ''
  }
})

function pick(o: ComboOption<V>) {
  if (o.disabled) return
  if (props.multiple) {
    const cur = selected.value
    model.value = cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur, o.value]
  } else {
    model.value = o.value
    open.value = false
  }
}

function remove(v: V) {
  model.value = props.multiple ? selected.value.filter((x) => x !== v) : null
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    active.value = Math.min(active.value + 1, shown.value.length - 1)
    e.preventDefault()
  } else if (e.key === 'ArrowUp') {
    active.value = Math.max(active.value - 1, 0)
    e.preventDefault()
  } else if (e.key === 'Enter') {
    const o = shown.value[active.value]
    if (o) pick(o)
    e.preventDefault()
  }
}

const groups = computed(() => {
  const out = new Map<string, { option: ComboOption<V>; index: number }[]>()
  shown.value.forEach((option, index) => {
    const g = option.group ?? ''
    if (!out.has(g)) out.set(g, [])
    out.get(g)!.push({ option, index })
  })
  return [...out.entries()]
})
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverAnchor as-child>
      <PopoverTrigger as-child :disabled="disabled">
        <button
          :id="id"
          type="button"
          :aria-invalid="invalid || undefined"
          :class="cn(
            'flex min-h-9 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 py-1 text-start text-sm outline-none transition-colors',
            'focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-60 aria-[invalid=true]:border-danger',
            multiple && 'flex-wrap py-1.5',
            props.class,
          )"
        >
          <template v-if="multiple">
            <span v-if="!selected.length" class="flex-1 text-muted-foreground/80">{{ placeholder }}</span>
            <span
              v-for="v in selected"
              :key="String(v)"
              class="inline-flex max-w-full items-center gap-1 rounded-md bg-subtle px-1.5 py-0.5 text-xs"
            >
              <span class="truncate" dir="auto">{{ labelOf(v) }}</span>
              <span v-if="!disabled" role="button" tabindex="-1" class="text-muted-foreground hover:text-foreground" @click.stop="remove(v)">
                <X class="size-3" />
              </span>
            </span>
            <ChevronsUpDown class="ms-auto size-4 opacity-50" />
          </template>
          <template v-else>
            <span :class="cn('flex-1 truncate', !selected.length && 'text-muted-foreground/80')" dir="auto">
              {{ selected.length ? labelOf(selected[0]) : placeholder }}
            </span>
            <span
              v-if="clearable && selected.length && !disabled"
              role="button"
              tabindex="-1"
              class="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              @click.stop="remove(selected[0])"
            >
              <X class="size-3.5" />
            </span>
            <ChevronsUpDown v-else class="size-4 opacity-50" />
          </template>
        </button>
      </PopoverTrigger>
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent
        :dir="direction"
        align="start"
        :side-offset="6"
        class="z-[60] w-[max(var(--reka-popover-trigger-width),18rem)] animate-in overflow-hidden rounded-xl border border-border bg-popover p-0 shadow-pop outline-none"
      >
        <div class="flex items-center gap-2 border-b border-border px-3">
          <Search class="size-4 text-muted-foreground" />
          <input
            ref="input"
            v-model="text"
            :placeholder="searchPlaceholder ?? t('common.search')"
            class="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            @keydown="onKey"
          />
        </div>
        <div class="max-h-72 overflow-y-auto p-1" role="listbox">
          <div v-if="loading" class="px-3 py-6 text-center text-sm text-muted-foreground">{{ t('common.loading') }}</div>
          <div v-else-if="!shown.length" class="px-3 py-6 text-center text-sm text-muted-foreground">{{ empty ?? t('common.noResults') }}</div>
          <template v-for="[group, items] in groups" :key="group">
            <div v-if="group" class="px-2.5 pb-1 pt-2 text-xs font-medium text-muted-foreground">{{ group }}</div>
            <div
              v-for="{ option, index } in items"
              :key="String(option.value)"
              role="option"
              :aria-selected="selected.includes(option.value)"
              :class="cn(
                'flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm',
                index === active && 'bg-muted',
                option.disabled && 'opacity-50',
              )"
              @mouseenter="active = index"
              @click="pick(option)"
            >
              <div class="min-w-0 flex-1">
                <div class="truncate" dir="auto">{{ option.label }}</div>
                <div v-if="option.hint" class="truncate text-xs text-muted-foreground" dir="auto">{{ option.hint }}</div>
              </div>
              <Check v-if="selected.includes(option.value)" class="size-4 text-primary" />
            </div>
          </template>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
