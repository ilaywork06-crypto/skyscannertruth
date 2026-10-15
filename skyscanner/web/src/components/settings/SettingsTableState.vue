<script setup lang="ts">
/** The body of a settings table while loading (skeleton rows) or when there is nothing to show. */
import { EmptyState, Skeleton } from '@truth-platform/ui'
defineProps<{ loading: boolean; empty: boolean; columns: number; title: string; description?: string }>()
</script>

<template>
  <tbody v-if="loading">
    <tr v-for="n in 4" :key="n">
      <td v-for="c in columns" :key="c" class="border-b border-border/70 px-3 py-3"><Skeleton class="h-4 w-full max-w-[10rem]" /></td>
    </tr>
  </tbody>
  <tbody v-else-if="empty">
    <tr>
      <td :colspan="columns">
        <EmptyState compact :title="title" :description="description">
          <template #icon><slot name="icon" /></template>
          <template v-if="$slots.action" #action><slot name="action" /></template>
        </EmptyState>
      </td>
    </tr>
  </tbody>
</template>
