<script setup lang="ts">
import { cn } from '../../lib/cn'
defineProps<{ clickable?: boolean; class?: string }>()
</script>

<template>
  <tr :class="cn('transition-colors [&:last-child>td]:border-0', clickable && 'cursor-pointer hover:bg-muted/60', $props.class)"><slot /></tr>
</template>
