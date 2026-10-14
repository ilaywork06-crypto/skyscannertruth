<script setup lang="ts">
import { cn } from '../../lib/cn'

withDefaults(
  defineProps<{ label: string; value: string | number; hint?: string; tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'; clickable?: boolean }>(),
  { tone: 'neutral' },
)
const emit = defineEmits<{ click: [] }>()
const tones = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary-soft-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning-foreground',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
}
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    :class="cn('card-surface flex flex-col gap-3 p-4 text-start', clickable && 'transition-all hover:-translate-y-px hover:shadow-pop')"
    @click="clickable && emit('click')"
  >
    <div class="flex items-center justify-between">
      <span class="text-[13px] font-medium text-muted-foreground">{{ label }}</span>
      <span v-if="$slots.icon" :class="cn('grid size-8 place-items-center rounded-lg [&_svg]:size-4', tones[tone])"><slot name="icon" /></span>
    </div>
    <div class="text-[28px] font-semibold leading-none tracking-tight tabular-nums">{{ value }}</div>
    <div v-if="hint" class="text-xs text-muted-foreground">{{ hint }}</div>
  </component>
</template>
