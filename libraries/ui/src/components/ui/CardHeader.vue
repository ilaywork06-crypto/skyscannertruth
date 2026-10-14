<script setup lang="ts">
import { cn } from '../../lib/cn'
defineProps<{ title?: string; description?: string; class?: string }>()
</script>

<template>
  <div :class="cn('flex items-start justify-between gap-3 px-5 pb-3 pt-4', $props.class)">
    <div class="flex min-w-0 items-start gap-3">
      <div
        v-if="$slots.icon"
        class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4"
      >
        <slot name="icon" />
      </div>
      <div class="min-w-0">
        <h3 class="text-[15px] font-semibold tracking-tight"><slot name="title">{{ title }}</slot></h3>
        <p v-if="description || $slots.description" class="mt-0.5 text-[13px] text-muted-foreground">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2"><slot name="actions" /></div>
  </div>
</template>
