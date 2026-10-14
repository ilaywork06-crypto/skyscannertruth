<script setup lang="ts">
import { Check, Minus } from 'lucide-vue-next'
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'
import { cn } from '../../lib/cn'
defineProps<{ disabled?: boolean; id?: string; class?: string }>()
const model = defineModel<boolean | 'indeterminate'>({ default: false })
</script>

<template>
  <CheckboxRoot
    :id="id"
    v-model="model"
    :disabled="disabled"
    :class="cn(
      'grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-input bg-card transition-colors disabled:opacity-50',
      'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
      'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
      $props.class,
    )"
    @click.stop
  >
    <CheckboxIndicator>
      <Minus v-if="model === 'indeterminate'" class="size-3.5" />
      <Check v-else class="size-3.5" :stroke-width="3" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
