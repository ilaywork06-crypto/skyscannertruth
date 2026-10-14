<script setup lang="ts">
import { TabsTrigger } from 'reka-ui'
import { cn } from '../../lib/cn'
defineProps<{ value: string; count?: number | null; class?: string; disabled?: boolean }>()
</script>

<template>
  <TabsTrigger
    :value="value"
    :disabled="disabled"
    :class="cn(
      'relative -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 pb-2.5 pt-1 text-sm font-medium text-muted-foreground transition-colors',
      'hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground disabled:opacity-50 [&_svg]:size-4',
      $props.class,
    )"
  >
    <slot name="icon" />
    <slot />
    <span v-if="count !== undefined && count !== null" class="rounded-full bg-subtle px-1.5 text-[11px] leading-5 text-muted-foreground">{{ count }}</span>
  </TabsTrigger>
</template>
