<script setup lang="ts">
/**
 * A new assumption, in one form: the assumption, who proposes it, the industries it is filed under (the one it
 * was opened from already picked), who validates it, its tags - then the fields of every schema those
 * industries fill in. Problems show after the first attempt and are re-checked live from then on.
 * Opened with `source`, it starts as a copy of that assumption (duplicate).
 */
import { FilePlus2, Shapes } from 'lucide-vue-next'
import {
  Badge, Button, Combobox, Dialog, EmptyState, Field, Input, Textarea, hashedTone, notify, reportError, translate as t,
  useDirtyGuard, type ComboOption,
} from '@truth-platform/ui'
import { computed, ref, watch } from 'vue'
import { createAssumption } from '@/api/endpoints'
import { useRegister } from '@/composables/register'
import type { AssumptionDetail, JsonValue } from '@/models'
import { validateValues } from '@/lib/constraints'
import { deriveName, readCreator, sortCaseless } from '@/lib/misc'
import SchemeFieldsForm from './SchemeFieldsForm.vue'
import TagInput from './TagInput.vue'

const props = defineProps<{ industry?: string | null; source?: AssumptionDetail | null }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [id: string] }>()
const register = useRegister()

const text = ref('')
const party = ref('')
const industryIds = ref<string[]>([])
const tags = ref<string[]>([])
const validators = ref<string[]>([])
const values = ref<Record<string, JsonValue>>({})
const attempted = ref(false)
const saving = ref(false)
let snapshot = ''

const state = () => JSON.stringify([text.value, party.value, industryIds.value, tags.value, validators.value, values.value])

watch(open, (o) => {
  if (!o) return
  const s = props.source
  text.value = s?.assumption_text ?? ''
  party.value = s?.proposing_party ?? ''
  industryIds.value = s
    ? s.industries.map((i) => register.findIndustry(i.id)?.id ?? register.findIndustry(i.name)?.id ?? i.id)
    : props.industry ? [register.findIndustry(props.industry)?.id ?? props.industry] : []
  tags.value = s ? [...s.tags] : []
  validators.value = s ? [...s.validation_responsible_parties] : []
  values.value = s ? { ...s.values } : {}
  attempted.value = false
  saving.value = false
  snapshot = state()
})

const industryOptions = computed<ComboOption<string>[]>(() => register.industries.value.map((i) => ({ value: i.id, label: i.name })))
const distinct = (pick: (row: (typeof register.assumptions.value)[number]) => string[]) =>
  sortCaseless([...new Set(register.assumptions.value.flatMap(pick).filter((v) => v.trim().length > 0))])
const knownParties = computed(() => distinct((r) => [r.proposing_party]))
const knownValidators = computed(() => distinct((r) => r.validation_responsible_parties))
const knownTags = computed(() => distinct((r) => r.tags))

const pickedSchemas = computed(() => register.schemasForIndustries(industryIds.value))
const fields = computed(() => register.fieldsForIndustries(industryIds.value))

const problems = computed(() => (attempted.value ? validateValues(fields.value, values.value) : {}))
const textError = computed(() => (attempted.value && !text.value.trim() ? t('create.textRequired') : null))
const partyError = computed(() => (attempted.value && !party.value.trim() ? t('create.partyRequired') : null))
const industriesError = computed(() => (attempted.value && !industryIds.value.length ? t('create.industriesRequired') : null))

const guard = useDirtyGuard({ isDirty: () => !saving.value && state() !== snapshot, close: () => (open.value = false) })

async function create() {
  attempted.value = true
  const found = validateValues(fields.value, values.value)
  const complete = text.value.trim() && party.value.trim() && industryIds.value.length > 0
  if (!complete || Object.keys(found).length) {
    notify(t('form.fixProblems'), 'warning')
    return
  }
  const kept: Record<string, JsonValue> = {}
  for (const f of fields.value) {
    const v = values.value[f.key]
    if (v !== null && v !== undefined) kept[f.key] = v
  }
  saving.value = true
  try {
    const id = await createAssumption({
      name: deriveName(text.value),
      assumption_text: text.value.trim(),
      proposing_party: party.value.trim(),
      schemas: pickedSchemas.value.map((s) => s.id),
      values: kept,
      tags: tags.value,
      validation_responsible_parties: validators.value,
      creator: readCreator(),
      // Industries go out by name (the id when the name is unknown); schemas by id.
      industries: industryIds.value.map((id) => register.findIndustry(id)?.name ?? id),
      special_fields: {},
    })
    notify(t('create.created'))
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
  <Dialog
    v-model:open="open"
    size="2xl"
    :title="source ? t('create.duplicateTitle') : t('create.title')"
    persistent
    @attempt-close="guard.attemptClose"
  >
    <template #icon><FilePlus2 /></template>
    <form class="flex flex-col gap-5" @submit.prevent="create">
      <Field :label="t('create.text')" required :error="textError" for="assumption-text">
        <Textarea
          id="assumption-text"
          v-model="text"
          rows="3"
          dir="auto"
          autofocus
         
          :invalid="!!textError"
          :placeholder="t('create.textPlaceholder')"
        />
      </Field>
      <div class="grid gap-4 sm:grid-cols-2">
        <Field :label="t('create.proposingParty')" required :error="partyError" for="assumption-party">
          <Input id="assumption-party" v-model="party" dir="auto" list="known-parties" :invalid="!!partyError" :placeholder="t('create.partyPlaceholder')" />
          <datalist id="known-parties"><option v-for="p in knownParties" :key="p" :value="p" /></datalist>
        </Field>
        <Field :label="t('create.industries')" required :error="industriesError" for="assumption-industries">
          <Combobox
            id="assumption-industries"
            v-model="industryIds"
            multiple
            :options="industryOptions"
            :invalid="!!industriesError"
            :placeholder="t('create.industriesPlaceholder')"
          />
        </Field>
        <Field :label="t('create.validators')" for="assumption-validators">
          <TagInput id="assumption-validators" v-model="validators" :suggestions="knownValidators" :placeholder="t('input.pressEnter')" />
        </Field>
        <Field :label="t('create.tags')" for="assumption-tags">
          <TagInput id="assumption-tags" v-model="tags" :suggestions="knownTags" :placeholder="t('input.pressEnter')" />
        </Field>
      </div>

      <section class="rounded-xl border border-border bg-muted/30 p-4">
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <Shapes class="size-4 text-muted-foreground" />
          <h4 class="text-sm font-semibold">{{ t('create.fields') }}</h4>
          <Badge>{{ fields.length }}</Badge>
          <span class="ms-auto flex flex-wrap gap-1">
            <Badge v-for="s in pickedSchemas" :key="s.id" :tone="hashedTone(s.name)"><span dir="auto">{{ s.name }}</span></Badge>
          </span>
        </div>
        <EmptyState v-if="!industryIds.length" compact :title="t('create.pickIndustry')" />
        <EmptyState v-else-if="!fields.length" compact :title="t('create.noFields')" />
        <SchemeFieldsForm v-else v-model="values" :fields="fields" :problems="problems" />
      </section>
    </form>
    <template #footer>
      <Button variant="ghost" @click="guard.attemptClose">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :loading="saving" @click="create">{{ t('create.create') }}</Button>
    </template>
  </Dialog>
</template>
