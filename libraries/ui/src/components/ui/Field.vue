<script setup lang="ts">
import { cn } from '../../lib/cn'
/** A labelled form row with an optional hint and error. */
defineProps<{ label?: string; hint?: string; error?: string | null; required?: boolean; for?: string; class?: string }>()
</script>

<template>
  <div :class="cn('flex flex-col gap-1.5', $props.class)">
    <div v-if="label || $slots.label" class="flex items-center justify-between gap-2">
      <label :for="$props.for" class="text-[13px] font-medium text-foreground">
        <slot name="label">{{ label }}</slot><span v-if="required" class="ms-0.5 text-danger">*</span>
      </label>
      <slot name="aside" />
    </div>
    <slot />
    <p v-if="error" class="text-xs text-danger" dir="auto">{{ error }}</p>
    <p v-else-if="hint || $slots.hint" class="text-xs text-muted-foreground"><slot name="hint">{{ hint }}</slot></p>
  </div>
</template>
