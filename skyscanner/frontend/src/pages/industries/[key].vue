<template>
  <div class="landing">
    <v-progress-circular
      indeterminate
      color="primary"
      size="40"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { writeSelectedIndustries } from '@/utils/industry-selection'

/*
 * An industry used to have a page of its own. The industries are now a filter on the one inventory, so an
 * address of an old industry page - a bookmark, a link in a mail - opens the inventory narrowed to it.
 */
const route = useRoute('/industries/[key]')
const router = useRouter()

onMounted(() => {
  const key = route.params.key
  writeSelectedIndustries([key])
  void router.replace({ path: '/events', query: { industries: key } })
})
</script>

<style scoped>
.landing {
  display: flex;
  align-items: center;
  justify-content: center;
  min-block-size: 100vh;
}
</style>
