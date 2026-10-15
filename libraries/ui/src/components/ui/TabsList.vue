<script setup lang="ts">
import { TabsList } from 'reka-ui'
import { cn } from '../../lib/cn'
defineProps<{ class?: string }>()
</script>

<template>
  <TabsList :class="cn('flex items-center gap-1 overflow-x-auto border-b border-border', $props.class)"><slot /></TabsList>
</template>
