<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '../../lib/cn'

const props = withDefaults(defineProps<{ value: number; max?: number; tone?: 'primary' | 'success' | 'warning' | 'danger'; class?: string; indeterminate?: boolean }>(), {
  max: 100,
  tone: 'primary',
})
const pct = computed(() => (props.max > 0 ? Math.max(0, Math.min(100, (props.value / props.max) * 100)) : 0))
const colors = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger' }
</script>

<template>
  <div :class="cn('h-1.5 w-full overflow-hidden rounded-full bg-subtle', props.class)" role="progressbar" :aria-valuenow="Math.round(pct)">
    <div
      :class="cn('h-full rounded-full transition-all', colors[tone], indeterminate && 'w-1/3 animate-pulse')"
      :style="indeterminate ? { opacity: 'var(--bar-opacity)' } : { width: `${pct}%`, opacity: 'var(--bar-opacity)' }"
    />
  </div>
</template>
