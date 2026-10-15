<script setup lang="ts">
import { cn } from '../../lib/cn'
import { badgeVariants, type BadgeTone } from './variants'

defineProps<{ tone?: BadgeTone; dot?: boolean; class?: string }>()
</script>

<template>
  <span :class="cn(badgeVariants({ tone }), $props.class)">
    <span v-if="dot" class="size-1.5 rounded-full bg-current" />
    <slot />
  </span>
</template>
