<script setup lang="ts">
import { DropdownMenuLabel } from 'reka-ui'
</script>

<template>
  <DropdownMenuLabel class="flex items-center gap-2 px-2.5 pb-1 pt-2 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
    <slot />
  </DropdownMenuLabel>
</template>
