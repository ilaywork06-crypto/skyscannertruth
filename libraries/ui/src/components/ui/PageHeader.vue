<script setup lang="ts">
import { cn } from '../../lib/cn'
defineProps<{ title?: string; description?: string; class?: string }>()
</script>

<template>
  <div :class="cn('mb-6 flex flex-wrap items-end justify-between gap-4', $props.class)">
    <div class="min-w-0">
      <div v-if="$slots.eyebrow" class="mb-1.5"><slot name="eyebrow" /></div>
      <h1 class="text-2xl font-semibold tracking-tight" dir="auto"><slot name="title">{{ title }}</slot></h1>
      <p v-if="description || $slots.description" class="mt-1 max-w-2xl text-sm text-muted-foreground">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2"><slot name="actions" /></div>
  </div>
</template>
