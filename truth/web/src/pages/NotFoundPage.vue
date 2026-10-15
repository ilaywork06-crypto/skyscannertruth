<script setup lang="ts">
import { Compass } from 'lucide-vue-next'
import { Button, EmptyState, translate as t } from '@truth-platform/ui'
import { RouterLink } from 'vue-router'
</script>

<template>
  <EmptyState :title="t('notFound.title')" :description="t('notFound.text')">
    <template #icon><Compass /></template>
    <template #action><Button as-child variant="primary"><RouterLink to="/industries">{{ t('notFound.home') }}</RouterLink></Button></template>
  </EmptyState>
</template>
