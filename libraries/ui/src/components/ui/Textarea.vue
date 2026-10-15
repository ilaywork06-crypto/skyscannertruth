<script setup lang="ts">
import { cn } from '../../lib/cn'
import { fieldClass } from './variants'

defineOptions({ inheritAttrs: false })
defineProps<{ class?: string; invalid?: boolean }>()
const model = defineModel<string | null | undefined>()
</script>

<template>
  <textarea
    v-bind="$attrs"
    v-model="model"
    :aria-invalid="invalid || undefined"
    :class="cn(fieldClass, 'min-h-20 py-2 leading-relaxed', $props.class)"
  />
</template>
