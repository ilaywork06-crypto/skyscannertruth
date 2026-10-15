<script setup lang="ts">
/** A new industry: a name (required) and a description. Asks before throwing typed text away. */
import { Building2 } from 'lucide-vue-next'
import { Button, Dialog, Field, Input, Textarea, notify, reportError, translate as t, useDirtyGuard } from '@truth-platform/ui'
import { computed, ref, watch } from 'vue'
import { createIndustry } from '@/api/endpoints'
import { readCreator } from '@/lib/misc'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [id: string] }>()

const name = ref('')
const description = ref('')
const attempted = ref(false)
const saving = ref(false)

watch(open, (o) => {
  if (!o) return
  name.value = ''
  description.value = ''
  attempted.value = false
  saving.value = false
})

const nameError = computed(() => (attempted.value && !name.value.trim() ? t('industry.nameRequired') : null))
const dirty = () => !saving.value && (name.value.trim().length > 0 || description.value.trim().length > 0)
const guard = useDirtyGuard({ isDirty: dirty, close: () => (open.value = false) })

async function create() {
  attempted.value = true
  if (!name.value.trim()) return
  saving.value = true
  try {
    const id = await createIndustry({ name: name.value.trim(), description: description.value.trim(), creator: readCreator() })
    notify(t('industry.created'))
    emit('created', id)
    open.value = false
  } catch (e) {
    reportError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open" :title="t('industry.create')" persistent @attempt-close="guard.attemptClose">
    <template #icon><Building2 /></template>
    <form class="flex flex-col gap-4" @submit.prevent="create">
      <Field :label="t('industry.name')" required :error="nameError" for="industry-name">
        <Input id="industry-name" v-model="name" dir="auto" autofocus :invalid="!!nameError" :placeholder="t('industry.namePlaceholder')" />
      </Field>
      <Field :label="t('common.description')" for="industry-description">
        <Textarea id="industry-description" v-model="description" dir="auto" rows="3" :placeholder="t('industry.descriptionPlaceholder')" />
      </Field>
    </form>
    <template #footer>
      <Button variant="ghost" @click="guard.attemptClose">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :loading="saving" @click="create">{{ t('create.create') }}</Button>
    </template>
  </Dialog>
</template>
