<template>
  <FormDialog
    :model-value="modelValue"
    :title="revising ? t('schemaForm.revise', { name: schema?.name ?? '' }) : t('schemaForm.declare')"
    icon="mdi-shape-outline"
    max-width="60rem"
    :submit-label="revising ? t('schemas.revise') : t('common.create')"
    :saving="saving"
    :dirty="dirty"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="submit"
  >
    <div class="schema-form">
      <template v-if="!revising">
        <div class="schema-form__grid">
          <div>
            <FieldLabel :text="t('schemaForm.name')" html-for="schema-name" required />
            <v-text-field
              id="schema-name"
              v-model="name"
              :placeholder="t('schemaForm.namePlaceholder')"
              :error-messages="showErrors && !name.trim() ? t('schemaForm.nameRequired') : undefined"
              dir="auto"
              autofocus
            />
          </div>
          <div>
            <FieldLabel :text="t('schemaForm.industries')" html-for="schema-industries" required :hint="t('schemaForm.industriesHint')" />
            <v-autocomplete
              id="schema-industries"
              v-model="industryIds"
              :items="industryItems"
              :error-messages="showErrors && industryIds.length === 0 ? t('schemaForm.industriesRequired') : undefined"
              multiple
              chips
              closable-chips
            />
          </div>
        </div>
        <div>
          <FieldLabel :text="t('common.description')" html-for="schema-description" />
          <v-textarea
            id="schema-description"
            v-model="description"
            :placeholder="t('schemaForm.descriptionPlaceholder')"
            rows="2"
            auto-grow
            dir="auto"
          />
        </div>
      </template>

      <div v-else>
        <FieldLabel :text="t('schemaForm.reason')" html-for="schema-reason" required />
        <v-text-field
          id="schema-reason"
          v-model="reason"
          :placeholder="t('schemaForm.reasonPlaceholder')"
          :error-messages="showErrors && !reason.trim() ? t('schemaForm.reasonRequired') : undefined"
          dir="auto"
          autofocus
        />
      </div>

      <SchemeBuilder v-model="fields" :show-errors="showErrors" />
    </div>
  </FormDialog>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'

import { schemasApi } from '@/api'
import type { SchemaDetail } from '@/domain/models'
import type { SchemeField } from '@/domain/scheme'
import { isSchemeValid, readScheme, writeScheme } from '@/domain/scheme'
import { useI18n } from '@/i18n'
import FieldLabel from '@/shared/components/FieldLabel.vue'
import FormDialog from '@/shared/components/FormDialog.vue'
import { currentCreator } from '@/shared/utils/identity'
import { useNotifications } from '@/stores/notifications'
import { useRegisterStore } from '@/stores/register'

import SchemeBuilder from './SchemeBuilder.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** The schema to revise; omitted to declare a new one. */
    schema?: SchemaDetail | null
    /** Preselected industry when declaring. */
    industryId?: string | null
  }>(),
  { schema: null, industryId: null },
)

const emit = defineEmits<{ 'update:modelValue': [open: boolean]; saved: [schemaId: string] }>()

const { t } = useI18n()
const register = useRegisterStore()
const { notify, reportError } = useNotifications()

const name = ref('')
const description = ref('')
const reason = ref('')
const industryIds = ref<string[]>([])
const fields = shallowRef<SchemeField[]>([])
const showErrors = ref(false)
const saving = ref(false)
const openedWith = ref('')

const revising = computed(() => props.schema !== null)
const industryItems = computed(() => register.industries.map((industry) => ({ title: industry.name, value: industry.id })))

const snapshot = () => JSON.stringify([name.value, description.value, reason.value, industryIds.value, fields.value])
const dirty = computed(() => !saving.value && snapshot() !== openedWith.value)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    name.value = ''
    description.value = ''
    reason.value = ''
    industryIds.value = props.industryId ? [props.industryId] : []
    fields.value = props.schema ? readScheme(props.schema.scheme) : []
    showErrors.value = false
    saving.value = false
    openedWith.value = snapshot()
  },
)

const valid = () =>
  isSchemeValid(fields.value) &&
  (revising.value ? reason.value.trim().length > 0 : name.value.trim().length > 0 && industryIds.value.length > 0)

const submit = async () => {
  showErrors.value = true
  if (!valid()) {
    notify(t('schemaForm.invalid'), 'warning')

    return
  }

  saving.value = true
  try {
    const scheme = writeScheme(fields.value)
    const creator = currentCreator()
    let schemaId: string
    if (props.schema === null) {
      schemaId = await schemasApi.create({
        name: name.value.trim(),
        description: description.value.trim(),
        type: 0,
        scheme,
        creator,
        industries: industryIds.value,
      })
    } else {
      await schemasApi.revise(props.schema.id, { creator, revision_reason: reason.value.trim(), scheme })
      schemaId = props.schema.id
    }

    await register.refreshSchema(schemaId)
    const shown = props.schema?.name ?? name.value.trim()
    notify(t(revising.value ? 'schemaForm.revised' : 'schemaForm.declared', { name: shown }), 'success')
    emit('saved', schemaId)
    emit('update:modelValue', false)
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.schema-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.schema-form__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  gap: 1rem;
}
</style>
