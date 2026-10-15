<script setup lang="ts">
import { cn } from '../../lib/cn'
defineProps<{ class?: string }>()
</script>

<template>
  <th :class="cn('h-10 whitespace-nowrap border-b border-border px-3 text-start align-middle text-xs font-medium text-muted-foreground', $props.class)"><slot /></th>
</template>
