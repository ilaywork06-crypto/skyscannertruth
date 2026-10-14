<script setup lang="ts">
import { Compass } from 'lucide-vue-next'
import { Button, EmptyState, translate as t } from '@truth-platform/ui'
</script>

<template>
  <EmptyState :title="t('notFound.title')" :description="t('notFound.text')">
    <template #icon><Compass /></template>
    <template #action><Button as="a" href="/events" variant="primary">{{ t('notFound.home') }}</Button></template>
  </EmptyState>
</template>
