<template>
  <span class="linked-text bidi">
    <template v-for="(part, index) in parts" :key="index">
      <a v-if="part.href" :href="part.href" target="_blank" rel="noopener noreferrer" @click.stop>{{ part.text }}</a>
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import { splitLinks } from '@/shared/utils/links'

const props = defineProps<{ text: string }>()

const parts = computed(() => splitLinks(props.text))
</script>

<style scoped>
.linked-text {
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.linked-text a {
  color: rgb(var(--v-theme-primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
