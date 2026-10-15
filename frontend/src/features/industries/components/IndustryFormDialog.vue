<template>
  <FormDialog
    :model-value="modelValue"
    :title="t('industry.create')"
    icon="mdi-domain-plus"
    max-width="32rem"
    :submit-label="t('common.create')"
    :saving="saving"
    :dirty="dirty"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="submit"
  >
    <div class="industry-form">
      <div>
        <FieldLabel :text="t('industry.name')" html-for="industry-name" required />
        <v-text-field
          id="industry-name"
          v-model="name"
          :placeholder="t('industry.namePlaceholder')"
          :error-messages="showErrors && !name.trim() ? t('industry.nameRequired') : undefined"
          dir="auto"
          autofocus
        />
      </div>
      <div>
        <FieldLabel :text="t('common.description')" html-for="industry-description" :hint="t('common.optional')" />
        <v-textarea id="industry-description" v-model="description" :placeholder="t('industry.descriptionPlaceholder')" rows="3" auto-grow dir="auto" />
      </div>
    </div>
  </FormDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { industriesApi } from '@/api'
import { useI18n } from '@/i18n'
import FieldLabel from '@/shared/components/FieldLabel.vue'
import FormDialog from '@/shared/components/FormDialog.vue'
import { currentCreator } from '@/shared/utils/identity'
import { useNotifications } from '@/stores/notifications'
import { useRegisterStore } from '@/stores/register'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [open: boolean]; created: [industryId: string] }>()

const { t } = useI18n()
const register = useRegisterStore()
const { notify, reportError } = useNotifications()

const name = ref('')
const description = ref('')
const saving = ref(false)
const showErrors = ref(false)

const dirty = computed(() => !saving.value && (name.value.trim().length > 0 || description.value.trim().length > 0))

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    name.value = ''
    description.value = ''
    showErrors.value = false
  },
)

const submit = async () => {
  showErrors.value = true
  if (!name.value.trim()) return

  saving.value = true
  try {
    const id = await industriesApi.create({ name: name.value.trim(), description: description.value.trim(), creator: currentCreator() })
    await register.refreshIndustries()
    notify(t('industry.created', { name: name.value.trim() }), 'success')
    emit('created', id)
    emit('update:modelValue', false)
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.industry-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
