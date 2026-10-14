<script setup lang="ts">
import { cn } from '../../lib/cn'
defineProps<{ title: string; description?: string; compact?: boolean; class?: string }>()
</script>

<template>
  <div :class="cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-16', $props.class)">
    <div
      v-if="$slots.icon"
      class="mb-4 grid size-12 place-items-center rounded-2xl border border-border bg-card text-muted-foreground shadow-soft [&_svg]:size-5"
    >
      <slot name="icon" />
    </div>
    <h3 class="text-[15px] font-semibold">{{ title }}</h3>
    <p v-if="description || $slots.description" class="mt-1 max-w-sm text-[13px] text-muted-foreground">
      <slot name="description">{{ description }}</slot>
    </p>
    <div v-if="$slots.action" class="mt-5"><slot name="action" /></div>
  </div>
</template>
