<script setup lang="ts">
/** `/` opens the industry last read in this browser, or the list of industries. */
import { Spinner, reportError } from '@truth-platform/ui'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRegister } from '@/composables/register'
import { readLastIndustry, writeLastIndustry } from '@/lib/misc'

const router = useRouter()
const register = useRegister()
onMounted(async () => {
  const last = readLastIndustry()
  if (!last) return void router.replace('/industries')
  try {
    await register.load()
  } catch (e) {
    reportError(e)
  }
  const industry = register.findIndustry(last)
  if (!industry) {
    writeLastIndustry(null)
    return void router.replace('/industries')
  }
  void router.replace(`/industries/${industry.id}`)
})
</script>

<template>
  <div class="grid min-h-[50vh] place-items-center"><Spinner class="size-6" /></div>
</template>
