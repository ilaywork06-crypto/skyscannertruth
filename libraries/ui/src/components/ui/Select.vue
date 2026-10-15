<script setup lang="ts" generic="V extends string | number">
import { Check, ChevronDown } from 'lucide-vue-next'
import {
  SelectContent, SelectIcon, SelectItem, SelectItemIndicator, SelectItemText, SelectPortal, SelectRoot,
  SelectTrigger, SelectValue, SelectViewport,
} from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../lib/cn'
import { usePreferences } from '../../theme/preferences'

export interface SelectOption<T extends string | number = string> {
  value: T
  label: string
  hint?: string
  disabled?: boolean
}

const EMPTY = '__none__'
const props = withDefaults(
  defineProps<{
    options: SelectOption<V>[]
    placeholder?: string
    /** Offer an explicit "none" entry that sets the value to null. */
    noneLabel?: string
    disabled?: boolean
    size?: 'sm' | 'md'
    id?: string
    invalid?: boolean
    class?: string
  }>(),
  { size: 'md' },
)
const model = defineModel<V | null | undefined>()
const { direction } = usePreferences()

const raw = computed({
  get: () => (model.value === null || model.value === undefined ? (props.noneLabel ? EMPTY : '') : String(model.value)),
  set: (v: string) => {
    if (v === EMPTY) model.value = null
    else model.value = props.options.find((o) => String(o.value) === v)?.value ?? null
  },
})
</script>

<template>
  <SelectRoot v-model="raw" :disabled="disabled" :dir="direction">
    <SelectTrigger
      :id="id"
      :aria-invalid="invalid || undefined"
      :class="cn(
        'flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-start text-sm outline-none transition-colors',
        'focus:border-primary focus:ring-[3px] focus:ring-ring disabled:opacity-60 data-[placeholder]:text-muted-foreground/80 [&>span]:truncate',
        'aria-[invalid=true]:border-danger',
        size === 'sm' ? 'h-8 text-[13px]' : 'h-9',
        props.class,
      )"
    >
      <SelectValue :placeholder="placeholder" dir="auto" />
      <SelectIcon><ChevronDown class="size-4 opacity-60" /></SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="6"
        class="z-[60] max-h-80 min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-pop animate-in"
      >
        <SelectViewport>
          <SelectItem
            v-for="o in noneLabel ? [{ value: EMPTY, label: noneLabel, muted: true }, ...options] : options"
            :key="String(o.value)"
            :value="String(o.value)"
            :disabled="'disabled' in o ? o.disabled : false"
            class="relative flex cursor-default select-none items-center gap-2 rounded-lg py-1.5 pe-8 ps-2.5 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50"
          >
            <div class="min-w-0">
              <SelectItemText>
                <span :class="'muted' in o && 'text-muted-foreground'" dir="auto">{{ o.label }}</span>
              </SelectItemText>
              <div v-if="'hint' in o && o.hint" class="text-xs text-muted-foreground">{{ o.hint }}</div>
            </div>
            <SelectItemIndicator class="absolute end-2"><Check class="size-4 text-primary" /></SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
