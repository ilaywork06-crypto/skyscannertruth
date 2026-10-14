<script setup lang="ts">
/** A long value read whole, with its links followable and a copy button. */
import { Copy } from 'lucide-vue-next'
import { copyText } from '../../lib/download'
import { translate as t } from '../../i18n'
import { notify } from '../../composables/notify'
import Button from './Button.vue'
import Dialog from './Dialog.vue'
import LinkedText from './LinkedText.vue'

const props = defineProps<{ value: string; title?: string; monospace?: boolean }>()
const open = defineModel<boolean>('open', { default: false })

async function copy() {
  const ok = await copyText(props.value)
  notify(ok ? t('value.copied') : t('errors.generic'), ok ? 'success' : 'error')
}
</script>

<template>
  <Dialog v-model:open="open" size="xl" :title="title || t('value.title')">
    <pre
      dir="auto"
      :class="['max-h-[65vh] whitespace-pre-wrap break-words rounded-xl border border-border bg-muted/40 p-4 [overflow-wrap:anywhere]', monospace ? 'mono text-[13px]' : 'font-sans text-sm']"
    ><LinkedText :text="value" /></pre>
    <template #footer>
      <Button variant="ghost" @click="copy"><Copy /> {{ t('value.copy') }}</Button>
      <Button variant="primary" @click="open = false">{{ t('common.close') }}</Button>
    </template>
  </Dialog>
</template>
