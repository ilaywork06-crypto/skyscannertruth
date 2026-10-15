<script setup lang="ts">
import { DropdownMenuItem } from 'reka-ui'
import { cn } from '../../lib/cn'

defineProps<{ danger?: boolean; disabled?: boolean; shortcut?: string; class?: string }>()
const emit = defineEmits<{ select: [Event] }>()
</script>

<template>
  <DropdownMenuItem
    :disabled="disabled"
    :class="cn(
      'flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 outline-none',
      'data-[highlighted]:bg-muted data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
      danger && 'text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger',
      $props.class,
    )"
    @select="(e: Event) => emit('select', e)"
  >
    <slot name="icon" />
    <span class="flex-1"><slot /></span>
    <span v-if="shortcut" class="text-xs text-muted-foreground">{{ shortcut }}</span>
  </DropdownMenuItem>
</template>
