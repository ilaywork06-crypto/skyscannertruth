<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { DropdownMenuCheckboxItem } from 'reka-ui'

defineProps<{ disabled?: boolean }>()
const checked = defineModel<boolean>('checked', { default: false })
</script>

<template>
  <DropdownMenuCheckboxItem
    v-model="checked"
    :disabled="disabled"
    class="flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50"
    @select="(e: Event) => e.preventDefault()"
  >
    <span class="grid size-4 place-items-center"><Check v-if="checked" class="size-4 text-primary" /></span>
    <slot />
  </DropdownMenuCheckboxItem>
</template>
