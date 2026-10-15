<script setup lang="ts">
/** A stored mdi icon name drawn with its lucide counterpart (unknown → the default building). */
import { computed } from 'vue'
import { iconFor } from '@/lib/icons'

const props = defineProps<{ name?: string | null; size?: number }>()
const icon = computed(() => iconFor(props.name))
</script>

<template>
  <component :is="icon" :style="size ? { width: `${size}px`, height: `${size}px` } : undefined" aria-hidden="true" />
</template>
