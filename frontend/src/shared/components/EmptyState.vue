<template>
  <div class="empty" :class="{ 'empty--compact': compact }">
    <div class="empty__icon">
      <v-icon :icon="icon" :size="compact ? 22 : 28" />
    </div>
    <div class="empty__title">{{ title }}</div>
    <p v-if="text" class="empty__text">{{ text }}</p>
    <div v-if="$slots.default" class="empty__actions"><slot /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ icon: string; title: string; text?: string; compact?: boolean }>()
</script>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 4rem 1.5rem;
  text-align: center;
}

.empty--compact {
  padding: 2rem 1rem;
}

.empty__icon {
  display: grid;
  place-items: center;
  inline-size: 3.5rem;
  block-size: 3.5rem;
  margin-block-end: 0.5rem;
  border-radius: 16px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

.empty--compact .empty__icon {
  inline-size: 2.75rem;
  block-size: 2.75rem;
}

.empty__title {
  font-size: 1rem;
  font-weight: 600;
}

.empty__text {
  max-inline-size: 26rem;
  color: rgb(var(--v-theme-muted));
  font-size: 0.875rem;
}

.empty__actions {
  margin-block-start: 0.75rem;
  display: flex;
  gap: 0.5rem;
}
</style>
