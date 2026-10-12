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
import { useSnackbar } from '@truth-platform/core-ui'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useRegister } from '@/composables/useRegister'
import { readLastIndustry, writeLastIndustry } from '@/utils/last-industry'

const router = useRouter()
const { load, findIndustry } = useRegister()
const { reportError } = useSnackbar()

/*
 * The client opens where the reader left off: the table of the industry they were last reading. An industry
 * that no longer exists is forgotten, and a reader who has not opened one yet starts from the list of them.
 */
onMounted(async () => {
  const last = readLastIndustry()
  if (last === null) {
    await router.replace('/industries')

    return
  }

  try {
    await load()
  } catch (error) {
    reportError(error)
  }

  const industry = findIndustry(last)
  if (industry === undefined) {
    writeLastIndustry(null)
    await router.replace('/industries')

    return
  }

  await router.replace(`/industries/${industry.id}`)
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
