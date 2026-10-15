<script setup lang="ts">
import { ref } from 'vue'
import { cn } from '../../lib/cn'
import { fieldClass } from './variants'

defineOptions({ inheritAttrs: false })
defineProps<{ class?: string; invalid?: boolean }>()
const model = defineModel<string | number | null | undefined>()
const el = ref<HTMLInputElement>()
defineExpose({ focus: () => el.value?.focus(), el })
</script>

<template>
  <div v-if="$slots.start || $slots.end" :class="cn('relative w-full', $props.class)">
    <span v-if="$slots.start" class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground [&_svg]:size-4">
      <slot name="start" />
    </span>
    <input
      ref="el"
      v-bind="$attrs"
      v-model="model"
      :aria-invalid="invalid || undefined"
      :class="cn(fieldClass, 'h-9', $slots.start && 'ps-9', $slots.end && 'pe-9')"
    />
    <span v-if="$slots.end" class="absolute end-2 top-1/2 -translate-y-1/2"><slot name="end" /></span>
  </div>
  <input
    v-else
    ref="el"
    v-bind="$attrs"
    v-model="model"
    :aria-invalid="invalid || undefined"
    :class="cn(fieldClass, 'h-9', $props.class)"
  />
</template>
