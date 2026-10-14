<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { cn } from '../../lib/cn'
withDefaults(defineProps<{ disabled?: boolean; id?: string; size?: 'sm' | 'md' }>(), { size: 'md' })
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <SwitchRoot
    :id="id"
    v-model="model"
    :disabled="disabled"
    :class="cn(
      'relative inline-flex shrink-0 cursor-pointer items-center rounded-full bg-input transition-colors data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50',
      size === 'sm' ? 'h-4 w-7' : 'h-5 w-9',
    )"
  >
    <SwitchThumb
      :class="cn(
        'block rounded-full bg-white shadow transition-transform',
        size === 'sm'
          ? 'size-3 translate-x-0.5 data-[state=checked]:translate-x-3.5 rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-3.5'
          : 'size-4 translate-x-0.5 data-[state=checked]:translate-x-[18px] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[18px]',
      )"
    />
  </SwitchRoot>
</template>
