<script setup lang="ts">
import { computed } from 'vue'
import { rgb } from '../../theme/palette'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 28 })
const HUES = [265, 200, 155, 25, 330, 60, 290, 180]
const initials = computed(() =>
  props.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?',
)
const style = computed(() => {
  const hue = HUES[[...props.name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length]
  return {
    width: `${props.size}px`,
    height: `${props.size}px`,
    fontSize: `${props.size * 0.38}px`,
    background: `linear-gradient(135deg, ${rgb([0.68, 0.15, hue])}, ${rgb([0.55, 0.17, hue + 30])})`,
  }
})
</script>

<template>
  <span class="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white" :style="style" aria-hidden="true">{{ initials }}</span>
</template>
