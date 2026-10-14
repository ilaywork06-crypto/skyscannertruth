<script setup lang="ts">
import { cn } from '../../lib/cn'
defineProps<{ class?: string }>()
</script>

<template>
  <div class="w-full overflow-x-auto">
    <table :class="cn('w-full text-sm [&_td:first-child]:ps-5 [&_td:last-child]:pe-5 [&_th:first-child]:ps-5 [&_th:last-child]:pe-5', $props.class)">
      <slot />
    </table>
  </div>
</template>
