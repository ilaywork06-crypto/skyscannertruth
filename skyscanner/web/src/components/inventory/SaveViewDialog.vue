<script setup lang="ts">
/** Save the current view: a name, a description, and whether every user sees it (else kept in this browser). */
import { Save } from 'lucide-vue-next'
import { Button, Dialog, Field, Input, Switch, translate as t } from '@truth-platform/ui'
import { ref, watch } from 'vue'

const props = defineProps<{ saving?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ save: [draft: { name: string; description: string; shared: boolean }] }>()
const name = ref('')
const description = ref('')
const shared = ref(false)
watch(open, (o) => {
  if (o) {
    name.value = ''
    description.value = ''
  }
})
function save() {
  if (!name.value.trim() || props.saving) return
  emit('save', { name: name.value.trim(), description: description.value.trim(), shared: shared.value })
}
</script>

<template>
  <Dialog v-model:open="open" size="sm" :title="t('view.saveTitle')">
    <template #icon><Save /></template>
    <div class="flex flex-col gap-4">
      <Field :label="t('view.name')" required for="view-name">
        <Input id="view-name" v-model="name" dir="auto" autofocus @keydown.enter="save" />
      </Field>
      <Field :label="t('view.description')" for="view-description">
        <Input id="view-description" v-model="description" dir="auto" />
      </Field>
      <label class="flex items-center gap-2.5 text-[13px]"><Switch v-model="shared" />{{ t('view.share') }}</label>
      <p class="text-xs text-muted-foreground">{{ shared ? t('view.sharedNote') : t('view.privateNote') }}</p>
    </div>
    <template #footer>
      <Button variant="ghost" @click="open = false">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :disabled="!name.trim()" :loading="saving" @click="save">{{ t('common.save') }}</Button>
    </template>
  </Dialog>
</template>
