<script setup lang="ts">
import { cn } from '../../lib/cn'
defineProps<{ class?: string }>()
</script>

<template>
  <div :class="cn('card-surface', $props.class)"><slot /></div>
</template>
