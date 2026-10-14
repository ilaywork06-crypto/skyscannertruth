<script setup lang="ts">
import { TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'
withDefaults(defineProps<{ content?: string | null; side?: 'top' | 'bottom' | 'left' | 'right'; delay?: number }>(), { side: 'top', delay: 300 })
</script>

<template>
  <slot v-if="!content && !$slots.content" />
  <TooltipRoot v-else :delay-duration="delay">
    <TooltipTrigger as-child><slot /></TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :side-offset="6"
        class="z-[70] max-w-xs animate-fade select-text break-words rounded-lg bg-foreground px-2.5 py-1.5 text-xs text-background shadow-pop [unicode-bidi:plaintext]"
      >
        <slot name="content">{{ content }}</slot>
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
