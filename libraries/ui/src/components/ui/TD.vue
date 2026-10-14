<script setup lang="ts">
import { cn } from '../../lib/cn'
defineProps<{ class?: string }>()
</script>

<template>
  <td :class="cn('border-b border-border/70 px-3 py-2.5 align-middle', $props.class)"><slot /></td>
</template>
