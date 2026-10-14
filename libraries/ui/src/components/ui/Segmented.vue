<script setup lang="ts" generic="V extends string">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import type { Component } from 'vue'
import { cn } from '../../lib/cn'

withDefaults(
  defineProps<{
    options: { value: V; label?: string; icon?: Component; title?: string }[]
    size?: 'sm' | 'md'
    disabled?: boolean
    class?: string
  }>(),
  { size: 'md' },
)
const model = defineModel<V>({ required: true })
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="model"
    :disabled="disabled"
    :class="cn('inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5', $props.class)"
    @update:model-value="(v) => v && (model = v as V)"
  >
    <ToggleGroupItem
      v-for="o in options"
      :key="o.value"
      :value="o.value"
      :title="o.title"
      :class="cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 font-medium text-muted-foreground transition-all [&_svg]:size-3.5',
        'hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-soft',
        size === 'sm' ? 'h-7 text-xs' : 'h-8 text-[13px]',
      )"
    >
      <component :is="o.icon" v-if="o.icon" />
      <span v-if="o.label">{{ o.label }}</span>
    </ToggleGroupItem>
  </ToggleGroupRoot>
</template>
