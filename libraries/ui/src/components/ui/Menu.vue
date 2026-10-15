<script setup lang="ts">
/** A dropdown menu: the trigger goes in #trigger (as-child), items in the default slot. */
import { DropdownMenuContent, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui'
import { cn } from '../../lib/cn'
import { usePreferences } from '../../theme/preferences'
import { panelClass } from './variants'

withDefaults(defineProps<{ align?: 'start' | 'center' | 'end'; side?: 'top' | 'bottom' | 'left' | 'right'; class?: string; modal?: boolean }>(), {
  align: 'end',
  modal: false,
})
const open = defineModel<boolean>('open', { default: false })
const { direction } = usePreferences()
</script>

<template>
  <DropdownMenuRoot v-model:open="open" :modal="modal" :dir="direction">
    <DropdownMenuTrigger as-child><slot name="trigger" /></DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :side-offset="6"
        :align="align"
        :side="side"
        :class="cn(panelClass, 'min-w-48 overflow-hidden p-1', $props.class)"
      >
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
