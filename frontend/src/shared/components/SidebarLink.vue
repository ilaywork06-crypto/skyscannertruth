<template>
  <v-tooltip :text="label" location="end" :disabled="!rail">
    <template #activator="{ props: tip }">
      <RouterLink v-bind="tip" :to="to" class="nav-link" :class="{ 'nav-link--active': active, 'nav-link--rail': rail }">
        <v-icon :icon="icon" size="20" />
        <span v-if="!rail">{{ label }}</span>
      </RouterLink>
    </template>
  </v-tooltip>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{ to: string; icon: string; label: string; rail: boolean; active: boolean }>()
</script>

<style scoped>
.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  color: rgb(var(--v-theme-on-surface));
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  opacity: 0.78;
  transition: background-color 0.15s, opacity 0.15s;
}

.nav-link--rail {
  justify-content: center;
}

.nav-link:hover {
  background: rgb(var(--v-theme-row-hover));
  opacity: 1;
}

.nav-link--active {
  background: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
  opacity: 1;
}

.nav-link--active::before {
  content: '';
  position: absolute;
  inset-inline-start: -0.85rem;
  inset-block: 0.5rem;
  inline-size: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--truth-gradient);
}
</style>
