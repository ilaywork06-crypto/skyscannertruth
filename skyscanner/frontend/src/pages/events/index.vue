<template>
  <div class="sky-page">
    <AppHeader>
      <template #tabs>
        <IndustryTabs
          :industries="industries"
          :model-value="pickedIndustries"
          @update:model-value="onIndustriesChange"
        />
      </template>
    </AppHeader>

    <div class="sky-page__content">
      <EventsInventory :industries="pickedIndustries" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppHeader from '@/components/AppHeader.vue'
import EventsInventory from '@/components/EventsInventory.vue'
import IndustryTabs from '@/components/IndustryTabs.vue'
import { useIndustries } from '@/composables/useIndustries'
import {
  parseIndustryParam,
  readSelectedIndustries,
  writeSelectedIndustries,
} from '@/utils/industry-selection'

/** Where the pick is written in the address, so a view of a few industries can be shared as a link. */
const QUERY_KEY = 'industries'

const route = useRoute()
const router = useRouter()
const { industries } = useIndustries()

/*
 * The pick lives in the address, and the address falls back to the pick this browser was last left on. An
 * industry the address names that no longer exists is simply not a tab, and the table does not narrow by it
 * once the industries are known.
 */
const pickedIndustries = computed<string[]>(() => {
  const named = parseIndustryParam(route.query[QUERY_KEY]) ?? readSelectedIndustries()
  if (industries.value.length === 0) {
    return named
  }

  const known = new Set(industries.value.map((industry) => industry.key))

  return named.filter((key) => known.has(key))
})

const writeQuery = (keys: string[]) => {
  const query = { ...route.query }
  if (keys.length === 0) {
    query[QUERY_KEY] = ''
  } else {
    query[QUERY_KEY] = keys.join(',')
  }
  void router.replace({ query })
}

const onIndustriesChange = (keys: string[]) => {
  writeSelectedIndustries(keys)
  writeQuery(keys)
}

/* A plain /events opens on the industries this browser was left on, and says so in the address. */
onMounted(() => {
  if (parseIndustryParam(route.query[QUERY_KEY]) === null) {
    writeQuery(readSelectedIndustries())
  }
})
</script>
