<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import { Primitive } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '../../lib/cn'
import { buttonVariants, type ButtonVariants } from './variants'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariants['variant']
    size?: ButtonVariants['size']
    loading?: boolean
    disabled?: boolean
    as?: string | object
    asChild?: boolean
    type?: 'button' | 'submit' | 'reset'
    class?: string
  }>(),
  { as: 'button', type: 'button' },
)
const classes = computed(() => cn(buttonVariants({ variant: props.variant, size: props.size }), props.class))
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :class="classes"
    :disabled="as === 'button' ? disabled || loading : undefined"
    :type="as === 'button' ? type : undefined"
    :aria-disabled="disabled || loading || undefined"
  >
    <template v-if="asChild"><slot /></template>
    <template v-else>
      <Loader2 v-if="loading" class="animate-spin" />
      <slot />
    </template>
  </Primitive>
</template>
