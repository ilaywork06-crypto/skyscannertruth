<script setup lang="ts">
/** A value with its http/https/mailto addresses made into real links (and the search term marked). */
import { computed } from 'vue'
import { splitLinks } from '../../lib/links'
import HighlightedText from './HighlightedText.vue'

const props = withDefaults(defineProps<{ text: string; term?: string; stored?: string }>(), { term: '', stored: '' })
const segments = computed(() => splitLinks(props.text))
</script>

<template>
  <template v-for="(s, i) in segments" :key="i">
    <a v-if="s.href" :href="s.href" target="_blank" rel="noopener noreferrer" class="ui-link" @click.stop>
      <HighlightedText v-if="term" :text="s.text" :term="term" />
      <template v-else>{{ s.text }}</template>
    </a>
    <HighlightedText v-else-if="term" :text="s.text" :term="term" :stored="stored" />
    <template v-else>{{ s.text }}</template>
  </template>
</template>
