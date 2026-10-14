<script setup lang="ts">
/** A value with the search term marked in it. Always text, never markup. */
import { computed } from 'vue'
import { matchesTerm, splitHighlights } from '../../lib/highlight'

const props = withDefaults(defineProps<{ text: string; term?: string; stored?: string }>(), { term: '', stored: '' })
const segments = computed(() => {
  const s = splitHighlights(props.text, props.term)
  if (!s.length && props.stored && matchesTerm(props.stored, props.term)) return [{ text: props.text, matched: true }]
  return s
})
</script>

<template>
  <template v-if="segments.length">
    <template v-for="(s, i) in segments" :key="i">
      <mark v-if="s.matched" class="ui-mark">{{ s.text }}</mark>
      <template v-else>{{ s.text }}</template>
    </template>
  </template>
  <template v-else>{{ text }}</template>
</template>
