<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { cn } from '../../lib/cn'
import { usePreferences } from '../../theme/preferences'
import { panelClass } from './variants'

withDefaults(defineProps<{ align?: 'start' | 'center' | 'end'; side?: 'top' | 'bottom' | 'left' | 'right'; class?: string }>(), {
  align: 'start',
})
const open = defineModel<boolean>('open', { default: false })
const { direction } = usePreferences()
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child><slot name="trigger" /></PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :dir="direction"
        :side-offset="6"
        :align="align"
        :side="side"
        :class="cn(panelClass, 'p-3 outline-none', $props.class)"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
