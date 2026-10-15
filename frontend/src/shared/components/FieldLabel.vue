<template>
  <label class="field-label" :for="htmlFor">
    <span class="bidi">{{ text }}</span>
    <span v-if="required" class="field-label__required" aria-hidden="true">*</span>
    <span v-if="hint" class="field-label__hint">{{ hint }}</span>
  </label>
</template>

<script setup lang="ts">
defineProps<{ text: string; htmlFor?: string; required?: boolean; hint?: string }>()
</script>

<style scoped>
.field-label {
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  margin-block-end: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 600;
}

.field-label__required {
  color: rgb(var(--v-theme-error));
}

.field-label__hint {
  margin-inline-start: auto;
  font-weight: 400;
  font-size: 0.75rem;
  color: rgb(var(--v-theme-muted));
}
</style>
