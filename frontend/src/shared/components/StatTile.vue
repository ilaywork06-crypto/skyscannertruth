<template>
  <div class="stat surface">
    <div class="stat__icon"><v-icon :icon="icon" size="20" /></div>
    <div>
      <div class="stat__value tabular">
        <v-progress-circular v-if="loading" indeterminate size="18" width="2" />
        <template v-else>{{ value }}</template>
      </div>
      <div class="stat__label">{{ label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ icon: string; label: string; value: number | string; loading?: boolean }>()
</script>

<style scoped>
.stat {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
}

.stat__icon {
  display: grid;
  place-items: center;
  inline-size: 2.5rem;
  block-size: 2.5rem;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

.stat__value {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.1;
  min-block-size: 1.65rem;
}

.stat__label {
  font-size: 0.8125rem;
  color: rgb(var(--v-theme-muted));
}
</style>
