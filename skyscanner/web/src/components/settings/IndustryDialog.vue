<script setup lang="ts">
/** New / edit industry: names, key (fixed once created - industries are never renamed), description, icon, modules. */
import { Building2 } from 'lucide-vue-next'
import {
  Button, Dialog, Field, Textarea, hasAName, isValidKey, joinNames, notify, reportError, splitNames, toKey, translate as t, useDirtyGuard,
} from '@truth-platform/ui'
import { useQueryClient } from '@tanstack/vue-query'
import { ref, watch } from 'vue'
import { createIndustry, invalidateTaxonomy, updateIndustry, type Industry } from '@/api/taxonomy'
import { useSettingsSnapshot } from '@/composables/useSettingsRename'
import ChipsInput from '@/components/create/ChipsInput.vue'
import IconPicker from './IconPicker.vue'
import KeyField from './KeyField.vue'
import NameFields from './NameFields.vue'

const props = defineProps<{ industry: Industry | null; taken: string[] }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [industry: Industry] }>()
const client = useQueryClient()

const english = ref('')
const hebrew = ref('')
const key = ref('')
const description = ref('')
const icon = ref('mdi-domain')
const modules = ref<(string | number)[]>([])
const tried = ref(false)
const saving = ref(false)

const draft = () => [english.value, hebrew.value, key.value, description.value, icon.value, modules.value]
const snap = useSettingsSnapshot(draft)
const { attemptClose } = useDirtyGuard({ isDirty: snap.isDirty, close: () => (open.value = false) })

watch(open, (o) => {
  if (!o) return
  const i = props.industry
  const names = i ? splitNames(i) : { english: '', hebrew: '' }
  english.value = names.english
  hebrew.value = names.hebrew
  key.value = i?.key ?? ''
  description.value = i?.description ?? ''
  icon.value = i?.icon || 'mdi-domain'
  modules.value = [...(i?.modules ?? [])]
  tried.value = false
  snap.mark()
}, { immediate: true })

watch(english, (now, before) => {
  if (!props.industry && key.value === toKey(before ?? '')) key.value = toKey(now)
})

const valid = () =>
  hasAName({ english: english.value, hebrew: hebrew.value }) &&
  (!!props.industry || (isValidKey(key.value) && !props.taken.includes(key.value.trim()))) &&
  /^mdi-[a-z0-9]+(-[a-z0-9]+)*$/.test(icon.value.trim())

async function save() {
  tried.value = true
  if (!valid()) return
  saving.value = true
  const names = joinNames({ english: english.value, hebrew: hebrew.value })
  const body = {
    ...names,
    description: description.value.trim(),
    icon: icon.value.trim(),
    modules: modules.value.map((m) => String(m).trim()).filter(Boolean),
  }
  try {
    const saved = props.industry
      ? await updateIndustry(props.industry.key, body)
      : await createIndustry({ key: key.value.trim(), ...body })
    await invalidateTaxonomy(client)
    notify(t('common.saved'), 'success')
    emit('saved', saved)
    open.value = false
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open" size="lg" persistent :title="industry ? t('industries.edit') : t('industries.newTitle')" @attempt-close="attemptClose">
    <template #icon><Building2 /></template>
    <form class="flex flex-col gap-4" @submit.prevent="save">
      <NameFields v-model:english="english" v-model:hebrew="hebrew" :show-errors="tried" autofocus id-prefix="industry" />
      <KeyField id="industry-key" v-model="key" :locked="!!industry" :taken="industry ? [] : taken" :show-errors="tried" />
      <Field :label="t('common.description')" for="industry-description">
        <Textarea id="industry-description" v-model="description" rows="2" dir="auto" />
      </Field>
      <IconPicker id="industry-icon" v-model="icon" />
      <Field :label="t('industries.modules')" for="industry-modules">
        <ChipsInput id="industry-modules" v-model="modules" />
      </Field>
    </form>
    <template #footer>
      <Button variant="ghost" @click="attemptClose">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :loading="saving" @click="save">{{ t('common.save') }}</Button>
    </template>
  </Dialog>
</template>
