<template>
  <!--
    The heading of a table inside a page or a panel: its name, how many rows it holds, and what can be done to
    it, on one line whose items share one centre. The line keeps the height of its controls whether or not
    there are any, so headings with and without a button line up with each other down the panel.
  -->
  <div class="section-header">
    <span
      v-if="icon.length > 0"
      class="section-header__icon"
    >
      <v-icon
        :icon="icon"
        size="18"
      />
    </span>
    <h3
      class="section-header__title"
      dir="auto"
    >
      {{ title }}
    </h3>
    <span
      v-if="count !== null"
      class="section-header__count"
      :aria-label="String(count)"
    >{{ count }}</span>
    <span class="section-header__spacer" />
    <div
      v-if="$slots.default"
      class="section-header__actions"
    >
      <slot />
    </div>
  </div>
</template>

<script lang="ts">
interface Props {
  title: string
  /** How many rows the table under the heading holds, or nothing to leave the count out. */
  count?: number | null
  icon?: string
}
</script>

<script setup lang="ts">
withDefaults(defineProps<Props>(), { count: null, icon: '' })
</script>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-block-size: 2rem;
  min-inline-size: 0;
}

.section-header__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  opacity: 0.8;
}

.section-header__title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-header__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-inline-size: 1.5rem;
  block-size: 1.375rem;
  padding-inline: 0.4375rem;
  border-radius: 999px;
  background-color: rgba(var(--v-theme-on-surface), 0.1);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.section-header__spacer {
  flex: 1 1 auto;
}

.section-header__actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 0 0 auto;
}
</style>
