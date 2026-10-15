<script setup lang="ts">
/**
 * Declaring a schema (name, description, global or for chosen industries, attributes) or revising one (a
 * reason and the attributes - which industries it belongs to is settled when it is declared).
 */
import { PencilLine, TableProperties } from 'lucide-vue-next'
import {
  Button, Combobox, Dialog, Field, Input, Switch, Textarea, notify, reportError, translate as t, useDirtyGuard,
  type ComboOption,
} from '@truth-platform/ui'
import { computed, ref, watch } from 'vue'
import { createSchema, createSchemaRevision } from '@/api/endpoints'
import { useRegister } from '@/composables/register'
import type { SchemaDetail } from '@/models'
import { readCreator } from '@/lib/misc'
import { isSchemeValid, readScheme, writeScheme, type SchemeField } from '@/lib/scheme'
import SchemeBuilder from './SchemeBuilder.vue'

const props = defineProps<{ revised?: SchemaDetail | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [id: string] }>()
const register = useRegister()

const name = ref('')
const description = ref('')
const reason = ref('')
const isGlobal = ref(false)
const industryIds = ref<string[]>([])
const fields = ref<SchemeField[]>([])
const attempted = ref(false)
const saving = ref(false)
let snapshot = ''

const revising = computed(() => !!props.revised)
const state = () => JSON.stringify([name.value, description.value, reason.value, isGlobal.value, industryIds.value, fields.value])

watch(open, (o) => {
  if (!o) return
  name.value = ''
  description.value = ''
  reason.value = ''
  isGlobal.value = false
  industryIds.value = []
  fields.value = props.revised ? readScheme(props.revised.scheme).fields : []
  attempted.value = false
  saving.value = false
  snapshot = state()
})

const industryOptions = computed<ComboOption<string>[]>(() => register.industries.value.map((i) => ({ value: i.id, label: i.name })))
const nameError = computed(() => (attempted.value && !revising.value && !name.value.trim() ? t('schemas.nameRequired') : null))
const reasonError = computed(() => (attempted.value && revising.value && !reason.value.trim() ? t('schemas.reasonRequired') : null))
const industriesError = computed(() =>
  attempted.value && !revising.value && !isGlobal.value && !industryIds.value.length ? t('create.industriesRequired') : null,
)

const valid = computed(() => {
  if (!isSchemeValid({ fields: fields.value })) return false
  if (revising.value) return reason.value.trim().length > 0
  return name.value.trim().length > 0 && (isGlobal.value || industryIds.value.length > 0)
})

const guard = useDirtyGuard({ isDirty: () => !saving.value && state() !== snapshot, close: () => (open.value = false) })

async function save() {
  attempted.value = true
  if (!valid.value) {
    notify(t('form.fixProblems'), 'warning')
    return
  }
  saving.value = true
  try {
    const scheme = writeScheme({ fields: fields.value })
    if (props.revised) {
      const id = await createSchemaRevision(props.revised.id, { creator: readCreator(), revision_reason: reason.value.trim(), scheme })
      notify(t('schemas.revised', { name: props.revised.name }))
      emit('saved', id)
    } else {
      const id = await createSchema({
        name: name.value.trim(),
        description: description.value.trim(),
        type: 0,
        scheme,
        creator: readCreator(),
        industries: isGlobal.value ? [] : industryIds.value,
        global: isGlobal.value,
      })
      notify(t('schemas.declared', { name: name.value.trim() }))
      emit('saved', id)
    }
    open.value = false
  } catch (e) {
    reportError(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:open="open"
    size="2xl"
    :title="revised ? t('schemas.reviseNamed', { name: revised.name }) : t('schemas.declare')"
    persistent
    @attempt-close="guard.attemptClose"
  >
    <template #icon><PencilLine v-if="revised" /><TableProperties v-else /></template>
    <div class="flex flex-col gap-5">
      <template v-if="revised">
        <Field :label="t('schemas.revisionReason')" required :error="reasonError" for="schema-reason">
          <Input id="schema-reason" v-model="reason" dir="auto" autofocus :invalid="!!reasonError" :placeholder="t('schemas.reasonPlaceholder')" />
        </Field>
      </template>
      <template v-else>
        <Field :label="t('schemas.name')" required :error="nameError" for="schema-name">
          <Input id="schema-name" v-model="name" dir="auto" autofocus :invalid="!!nameError" :placeholder="t('schemas.namePlaceholder')" />
        </Field>
        <Field :label="t('common.description')" for="schema-description">
          <Textarea id="schema-description" v-model="description" dir="auto" rows="2" :placeholder="t('schemas.descriptionPlaceholder')" />
        </Field>
        <label class="flex items-center gap-3 text-sm font-medium">
          <Switch v-model="isGlobal" />
          {{ t('schemas.global') }}
        </label>
        <Field v-if="!isGlobal" :label="t('create.industries')" required :error="industriesError" for="schema-industries">
          <Combobox id="schema-industries" v-model="industryIds" multiple :options="industryOptions" :invalid="!!industriesError" :placeholder="t('create.industriesPlaceholder')" />
        </Field>
      </template>
      <SchemeBuilder v-model="fields" />
    </div>
    <template #footer>
      <Button variant="ghost" @click="guard.attemptClose">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :loading="saving" @click="save">{{ revised ? t('schemas.revise') : t('create.create') }}</Button>
    </template>
  </Dialog>
</template>
