<script setup lang="ts">
/** New / edit platform: names, key (rename with a dry run), description, industries (at least one). */
import { Tags } from 'lucide-vue-next'
import {
  Button, Combobox, Dialog, Field, Textarea, hasAName, isValidKey, joinNames, localName, notify, reportError, splitNames, toKey,
  translate as t, useDirtyGuard, type ComboOption,
} from '@truth-platform/ui'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { createPlatform, invalidateTaxonomy, previewPlatformRename, updatePlatform, useIndustries, type Industry, type Platform } from '@/api/taxonomy'
import { useSettingsRename, useSettingsSnapshot } from '@/composables/useSettingsRename'
import KeyField from './KeyField.vue'
import NameFields from './NameFields.vue'

const props = defineProps<{ platform: Platform | null; taken: string[]; defaultIndustry?: string | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()
const client = useQueryClient()
const { industries } = useIndustries()
const rename = useSettingsRename(previewPlatformRename)

const english = ref('')
const hebrew = ref('')
const key = ref('')
const description = ref('')
const chosen = ref<string[]>([])
const tried = ref(false)
const saving = ref(false)

const industryOptions = computed<ComboOption<string>[]>(() => (industries.value as Industry[]).map((i) => ({ value: i.key, label: localName(i) })))
const snap = useSettingsSnapshot(() => [english.value, hebrew.value, key.value, description.value, chosen.value])
const { attemptClose } = useDirtyGuard({ isDirty: snap.isDirty, close: () => (open.value = false) })
const keyTaken = computed(() => props.taken.filter((k) => k !== props.platform?.key))

watch(open, (o) => {
  if (!o) return
  const p = props.platform
  const names = p ? splitNames(p) : { english: '', hebrew: '' }
  english.value = names.english
  hebrew.value = names.hebrew
  key.value = p?.key ?? ''
  description.value = p?.description ?? ''
  chosen.value = p ? [...p.industries] : props.defaultIndustry ? [props.defaultIndustry] : []
  tried.value = false
  rename.reset()
  snap.mark()
}, { immediate: true })

watch(english, (now, before) => {
  if (!props.platform && key.value === toKey(before ?? '')) key.value = toKey(now)
})

const locked = computed(() => !!props.platform && !rename.unlocked.value)
const valid = () =>
  hasAName({ english: english.value, hebrew: hebrew.value }) &&
  (locked.value || (isValidKey(key.value) && !keyTaken.value.includes(key.value.trim()))) &&
  chosen.value.length > 0

async function save() {
  tried.value = true
  if (!valid()) return
  saving.value = true
  const names = joinNames({ english: english.value, hebrew: hebrew.value })
  try {
    if (props.platform) {
      const moved = key.value.trim() !== props.platform.key
      await updatePlatform(props.platform.id, {
        ...(moved ? { key: key.value.trim() } : {}),
        ...names,
        description: description.value.trim(),
        industries: chosen.value,
      })
    } else {
      await createPlatform({ key: key.value.trim(), ...names, description: description.value.trim(), industries: chosen.value, order: 100 })
    }
    await invalidateTaxonomy(client)
    notify(t('common.saved'), 'success')
    emit('saved')
    open.value = false
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open" size="lg" persistent :title="platform ? t('platforms.edit') : t('platforms.newTitle')" @attempt-close="attemptClose">
    <template #icon><Tags /></template>
    <form class="flex flex-col gap-4" @submit.prevent="save">
      <NameFields v-model:english="english" v-model:hebrew="hebrew" :show-errors="tried" autofocus id-prefix="platform" />
      <KeyField
        id="platform-key"
        v-model="key"
        :locked="locked"
        renamable
        :taken="keyTaken"
        :show-errors="tried"
        :summary="rename.summary.value"
        :checking="rename.checking.value"
        @unlock="platform && rename.start(platform.id, platform.key)"
      />
      <Field :label="t('common.description')" for="platform-description">
        <Textarea id="platform-description" v-model="description" rows="2" dir="auto" />
      </Field>
      <Field :label="t('settings.industries')" required for="platform-industries" :error="tried && !chosen.length ? t('platforms.industryRequired') : null">
        <Combobox id="platform-industries" v-model="chosen" multiple :options="industryOptions" :placeholder="t('settings.pickIndustries')" :invalid="tried && !chosen.length" />
      </Field>
    </form>
    <template #footer>
      <Button variant="ghost" @click="attemptClose">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :loading="saving" @click="save">{{ t('common.save') }}</Button>
    </template>
  </Dialog>
</template>
