<template>
  <div class="page page--narrow">
    <div class="surface">
      <EmptyState icon="mdi-map-marker-question-outline" title="404" :text="t('common.notFound')">
        <v-btn color="primary" to="/industries">{{ t('common.goHome') }}</v-btn>
      </EmptyState>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/i18n'
import EmptyState from '@/shared/components/EmptyState.vue'

const { t } = useI18n()
</script>
