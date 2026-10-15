<template>
  <span class="bidi">
    <template v-for="(part, index) in parts" :key="index">
      <mark v-if="part.hit" class="hit">{{ part.text }}</mark>
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ text: string; term: string }>()

/** Split the text around every case-insensitive occurrence of the search term. */
const parts = computed(() => {
  const needle = props.term.trim().toLowerCase()
  if (needle.length === 0) {
    return [{ text: props.text, hit: false }]
  }
  const found: { text: string; hit: boolean }[] = []
  const lowered = props.text.toLowerCase()
  let from = 0
  let at = lowered.indexOf(needle)
  while (at !== -1) {
    if (at > from) found.push({ text: props.text.slice(from, at), hit: false })
    found.push({ text: props.text.slice(at, at + needle.length), hit: true })
    from = at + needle.length
    at = lowered.indexOf(needle, from)
  }
  if (from < props.text.length) found.push({ text: props.text.slice(from), hit: false })

  return found
})
</script>

<style scoped>
.hit {
  padding-inline: 1px;
  border-radius: 3px;
  background: rgba(var(--v-theme-warning), 0.3);
  color: inherit;
}
</style>
