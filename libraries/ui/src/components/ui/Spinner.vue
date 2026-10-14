<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { cn } from '../../lib/cn'
defineProps<{ class?: string }>()
</script>

<template>
  <Loader2 :class="cn('size-5 animate-spin text-muted-foreground', $props.class)" />
</template>
