<script setup lang="ts">
/**
 * New / edit declared field. Names, key (rename with a dry run), type, section (event fields / entity fields /
 * additional data), entity type and industry (asked when the entity type does not settle it), the event types
 * that ask for an event field, allowed values (enum), description, conditions it depends on (entity fields),
 * multiple values / required / shown in the table. Event fields are bound to the chosen event types after save.
 * Scope, industry, entity type and section are fixed once created (the service ignores them in an edit).
 */
import { Plus, TableProperties, X } from 'lucide-vue-next'
import {
  Button, Checkbox, Combobox, Dialog, Field, Select, Switch, Textarea, hasAName, isValidKey, joinIsolated, joinNames, localName, notify,
  reportError, splitNames, toKey, translate as t, useDirtyGuard, type ComboOption, type SelectOption,
} from '@truth-platform/ui'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, shallowRef, watch } from 'vue'
import {
  createField, invalidateTaxonomy, listFields, previewFieldRename, updateEventType, updateField, useIndustries,
  type DependencyOperator, type EntityType, type EventType, type FieldDefinition, type FieldDependency, type FieldType, type Industry,
} from '@/api/taxonomy'
import { useSettingsRename, useSettingsSnapshot } from '@/composables/useSettingsRename'
import ChipsInput from '@/components/create/ChipsInput.vue'
import KeyField from './KeyField.vue'
import NameFields from './NameFields.vue'
import { FIELD_TYPE_OPTIONS, LISTABLE_TYPES, typeLabel, type FieldSection } from './fieldTypes'

const OPERATORS: DependencyOperator[] = ['has_value', 'is_empty', 'one_of', 'not_equals']

const props = defineProps<{
  field: FieldDefinition | null
  section: FieldSection
  industry: string | null
  fields: FieldDefinition[]
  eventTypes: EventType[]
  entityTypes: EntityType[]
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()
const client = useQueryClient()
const { industries, find } = useIndustries()
const rename = useSettingsRename(previewFieldRename)

const english = ref('')
const hebrew = ref('')
const key = ref('')
const type = ref<FieldType>('string')
const section = ref<FieldSection>('event')
const industry = ref<string | null>(null)
const entityType = ref<string | null>(null)
const options = ref<(string | number)[]>([])
const description = ref('')
const dependencies = ref<FieldDependency[]>([])
const chosenEventTypes = ref<string[]>([])
const required = ref(false)
const visible = ref(true)
const array = ref(false)
const candidates = shallowRef<FieldDefinition[]>([])
const tried = ref(false)
const saving = ref(false)

const editing = computed(() => !!props.field)
const eventScope = computed(() => section.value === 'event')
const industryName = (k: string) => {
  const i = find(k)
  return i ? localName(i) : k
}
const chosenEntityType = computed(() => props.entityTypes.find((x) => x.key === entityType.value) ?? null)
const typeIndustries = computed(() => chosenEntityType.value?.industries ?? [])
const industryAsked = computed(() => eventScope.value || !chosenEntityType.value || typeIndustries.value.length > 1)
const resolvedIndustry = computed(() => (industryAsked.value ? industry.value : (typeIndustries.value[0] ?? null)))
const canBeList = computed(() => LISTABLE_TYPES.has(type.value))

const sectionOptions = computed<SelectOption<FieldSection>[]>(() => [
  { value: 'event', label: t('schema.sectionEvent') },
  { value: 'own', label: t('schema.sectionEntity') },
  { value: 'additional', label: t('schema.sectionAdditional') },
])
const typeOptions = computed<SelectOption<FieldType>[]>(() => {
  const list = [...FIELD_TYPE_OPTIONS]
  if (props.field && !list.includes(props.field.type)) list.push(props.field.type)
  return list.map((v) => ({ value: v, label: typeLabel(v) }))
})
const industryOptions = computed<ComboOption<string>[]>(() => {
  const all = industries.value as Industry[]
  const offered = typeIndustries.value.length ? all.filter((i) => typeIndustries.value.includes(i.key)) : all
  return offered.map((i) => ({ value: i.key, label: localName(i) }))
})
const entityTypeOptions = computed<ComboOption<string>[]>(() =>
  props.entityTypes.map((x) => ({ value: x.key, label: joinIsolated([localName(x), joinIsolated(x.industries.map(industryName))], ' · ') })),
)
const eventTypesFor = (ind: string | null) => props.eventTypes.filter((x) => ind === null || !x.industries.length || x.industries.includes(ind))
const offeredEventTypes = computed(() => eventTypesFor(industry.value))
const eventTypeOptions = computed<ComboOption<string>[]>(() =>
  offeredEventTypes.value.map((x) => ({
    value: x.key,
    label: x.industries.length ? joinIsolated([localName(x), joinIsolated(x.industries.map(industryName))], ' · ') : localName(x),
  })),
)
const allEventTypesChosen = computed(() => offeredEventTypes.value.length > 0 && offeredEventTypes.value.every((x) => chosenEventTypes.value.includes(x.key)))
const someEventTypesChosen = computed(() => chosenEventTypes.value.length > 0 && !allEventTypesChosen.value)
function toggleAllEventTypes() {
  chosenEventTypes.value = allEventTypesChosen.value ? [] : offeredEventTypes.value.map((x) => x.key)
}
const operatorOptions = computed<SelectOption<DependencyOperator>[]>(() => OPERATORS.map((o) => ({ value: o, label: t(`schema.operator.${o}`) })))
const candidateOptions = computed<SelectOption<string>[]>(() =>
  candidates.value.filter((c) => c.key !== key.value).map((c) => ({ value: c.key, label: localName({ name: c.name, name_he: c.metadata.name_he }) })),
)

const taken = computed(() =>
  editing.value
    ? props.fields.filter((f) => f.id !== props.field?.id && f.scope === props.field?.scope && f.industry === props.field?.industry && f.entity_type === props.field?.entity_type).map((f) => f.key)
    : props.fields
        .filter((f) => f.scope === (eventScope.value ? 'event' : 'entity') && f.industry === resolvedIndustry.value && f.entity_type === (eventScope.value ? null : entityType.value))
        .map((f) => f.key),
)
const locked = computed(() => editing.value && !rename.unlocked.value)

const snap = useSettingsSnapshot(() => [
  english.value, hebrew.value, key.value, type.value, section.value, industry.value, entityType.value, options.value,
  description.value, dependencies.value, chosenEventTypes.value, required.value, visible.value, array.value,
])
const { attemptClose } = useDirtyGuard({ isDirty: snap.isDirty, close: () => (open.value = false) })

/* ------------------------------------------------------------- opening */
watch(open, (o) => {
  if (!o) return
  const f = props.field
  const names = f ? splitNames({ name: f.name, name_he: f.metadata.name_he }) : { english: '', hebrew: '' }
  english.value = names.english
  hebrew.value = names.hebrew
  key.value = f?.key ?? ''
  type.value = f?.type ?? 'string'
  section.value = f ? (f.scope === 'event' ? 'event' : f.additional ? 'additional' : 'own') : props.section
  industry.value = f ? f.industry : props.industry
  entityType.value = f?.entity_type ?? null
  options.value = [...(f?.metadata.options ?? [])]
  description.value = f?.metadata.description ?? ''
  dependencies.value = (f?.depends_on ?? []).map((d) => ({ ...d, values: [...d.values] }))
  chosenEventTypes.value =
    f ? (f.scope === 'event' ? eventTypesFor(f.industry).filter((x) => x.custom_fields.includes(f.key)).map((x) => x.key) : []) : eventTypesFor(industry.value).map((x) => x.key)
  required.value = f?.required ?? false
  visible.value = f?.visible ?? true
  array.value = f?.array ?? false
  tried.value = false
  rename.reset()
  snap.mark()
  void refreshCandidates()
}, { immediate: true })

watch(english, (now, before) => {
  if (!editing.value && key.value === toKey(before ?? '')) key.value = toKey(now)
})

/* A new event field follows the industry to all its event types when everything was chosen before. */
watch([industry, section], ([, ], [before]) => {
  if (!open.value || !eventScope.value) return
  const previous = eventTypesFor(before ?? null).map((x) => x.key)
  const wasAll = !chosenEventTypes.value.length || previous.every((k) => chosenEventTypes.value.includes(k))
  const offered = offeredEventTypes.value.map((x) => x.key)
  chosenEventTypes.value = !editing.value && wasAll ? offered : chosenEventTypes.value.filter((k) => offered.includes(k))
})

let candidatesToken = 0
async function refreshCandidates() {
  const token = ++candidatesToken
  if (eventScope.value) {
    candidates.value = []
    return
  }
  try {
    const list = await listFields({ scope: 'entity', industry: resolvedIndustry.value, entity_type: entityType.value, include_shared: true })
    if (token !== candidatesToken) return
    candidates.value = entityType.value === null ? list.filter((c) => c.entity_type === null) : list
    const offered = new Set(candidates.value.map((c) => c.key))
    dependencies.value = dependencies.value.filter((d) => offered.has(d.field))
  } catch (error) {
    reportError(error)
  }
}
watch([industry, entityType, section], () => {
  if (open.value) void refreshCandidates()
})

function addDependency() {
  const first = candidateOptions.value[0]?.value
  if (first) dependencies.value = [...dependencies.value, { field: first, operator: 'has_value', values: [] }]
}
function patchDependency(i: number, change: Partial<FieldDependency>) {
  dependencies.value = dependencies.value.map((d, j) => (j === i ? { ...d, ...change } : d))
}
const scalars = (values: unknown[]) => values.filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
function removeDependency(i: number) {
  dependencies.value = dependencies.value.filter((_, j) => j !== i)
}

/* ------------------------------------------------------------- saving */
const enumMissing = computed(() => type.value === 'enum' && options.value.length === 0)
const typesMissing = computed(() => eventScope.value && chosenEventTypes.value.length === 0)
const valid = () =>
  hasAName({ english: english.value, hebrew: hebrew.value }) &&
  (locked.value || (isValidKey(key.value) && !taken.value.includes(key.value.trim()))) &&
  !enumMissing.value &&
  !typesMissing.value

const metadata = () => ({
  allowed_file_types: props.field?.metadata.allowed_file_types ?? [],
  name_he: hebrew.value.trim() || null,
  options: options.value.map(String),
  unit: props.field?.metadata.unit ?? null,
  description: description.value.length ? description.value : null,
  placeholder: props.field?.metadata.placeholder ?? null,
  group: props.field?.metadata.group ?? null,
})

async function bindEventTypes(newKey: string, previousKey: string | null) {
  const chosen = new Set(chosenEventTypes.value)
  const changes = eventTypesFor(resolvedIndustry.value).flatMap((x) => {
    const asked = x.custom_fields.map((k) => (k === previousKey ? newKey : k))
    const bound = asked.includes(newKey)
    const wanted = chosen.has(x.key)
    if (bound === wanted) return []
    return [{ id: x.id, custom_fields: wanted ? [...asked, newKey] : asked.filter((k) => k !== newKey) }]
  })
  await Promise.all(changes.map((c) => updateEventType(c.id, { custom_fields: c.custom_fields })))
}

async function save() {
  tried.value = true
  if (!valid()) return
  saving.value = true
  const { name } = joinNames({ english: english.value, hebrew: hebrew.value })
  const finalKey = key.value.trim()
  const storedArray = canBeList.value && array.value
  const dependsOn = eventScope.value ? [] : dependencies.value
  try {
    const f = props.field
    if (!f) {
      await createField({
        name,
        key: finalKey,
        type: type.value,
        array: storedArray,
        default: null,
        required: required.value,
        scope: eventScope.value ? 'event' : 'entity',
        industry: resolvedIndustry.value,
        entity_type: eventScope.value ? null : entityType.value,
        additional: section.value === 'additional',
        metadata: metadata(),
        constraints: [],
        depends_on: dependsOn,
        filterable: true,
        sortable: true,
        editable: true,
        visible: visible.value,
        order: 100,
      })
    } else {
      await updateField(f.id, {
        ...(finalKey !== f.key ? { key: finalKey } : {}),
        name,
        type: type.value,
        array: storedArray,
        required: required.value,
        visible: visible.value,
        metadata: metadata(),
        depends_on: f.scope === 'event' ? f.depends_on : dependsOn,
      })
    }
    if (eventScope.value) await bindEventTypes(finalKey, f ? f.key : null)
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
  <Dialog v-model:open="open" size="lg" persistent class="max-w-[40rem]" :title="field ? t('schema.edit') : t('schema.newTitle')" @attempt-close="attemptClose">
    <template #icon><TableProperties /></template>
    <form class="flex flex-col gap-4" @submit.prevent="save">
      <NameFields v-model:english="english" v-model:hebrew="hebrew" :show-errors="tried" autofocus id-prefix="field" />
      <KeyField
        id="field-key"
        v-model="key"
        :locked="locked"
        renamable
        :taken="taken"
        :show-errors="tried"
        :summary="rename.summary.value"
        :checking="rename.checking.value"
        @unlock="field && rename.start(field.id, field.key)"
      />
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field :label="t('schema.type')" for="field-type">
          <Select id="field-type" v-model="type" :options="typeOptions" />
        </Field>
        <Field :label="t('schema.section')" for="field-section" :hint="editing ? t('settings.fixedOnceCreated') : undefined">
          <Select id="field-section" v-model="section" :options="sectionOptions" :disabled="editing" />
        </Field>
      </div>

      <Field v-if="!eventScope" :label="t('schema.entityType')" for="field-entity-type">
        <Combobox id="field-entity-type" v-model="entityType" :options="entityTypeOptions" :placeholder="t('schema.everyEntityType')" :disabled="editing" />
      </Field>

      <Field v-if="industryAsked" :label="t('schema.industry')" for="field-industry">
        <Combobox id="field-industry" v-model="industry" :options="industryOptions" :placeholder="t('common.allIndustries')" :disabled="editing" />
      </Field>

      <Field
        v-if="eventScope"
        :label="t('schema.eventTypes')"
        required
        for="field-event-types"
        :error="tried && typesMissing ? t('input.required', { name: t('schema.eventTypes') }) : null"
      >
        <template v-if="eventTypeOptions.length > 1" #aside>
          <label class="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox :model-value="allEventTypesChosen ? true : someEventTypesChosen ? 'indeterminate' : false" @update:model-value="toggleAllEventTypes" />
            {{ t('filters.selectAll') }}
          </label>
        </template>
        <Combobox id="field-event-types" v-model="chosenEventTypes" multiple :options="eventTypeOptions" :placeholder="'—'" :invalid="tried && typesMissing" />
      </Field>

      <Field v-if="type === 'enum'" :label="t('schema.options')" required for="field-options" :error="tried && enumMissing ? t('input.required', { name: t('schema.options') }) : null">
        <ChipsInput id="field-options" v-model="options" :invalid="tried && enumMissing" />
      </Field>

      <Field :label="t('common.description')" for="field-description">
        <Textarea id="field-description" v-model="description" rows="2" dir="auto" />
      </Field>

      <section v-if="!eventScope" class="rounded-xl border border-border p-3">
        <div class="mb-2 flex items-center justify-between">
          <h4 class="text-[13px] font-medium">{{ t('schema.dependsOn') }}</h4>
          <Button variant="ghost" size="xs" :disabled="!candidateOptions.length" @click="addDependency"><Plus /> {{ t('schema.addCondition') }}</Button>
        </div>
        <p v-if="!dependencies.length" class="text-xs text-muted-foreground">—</p>
        <div v-for="(dep, i) in dependencies" :key="i" class="mb-2 grid grid-cols-[1fr_1fr_auto] items-start gap-2 last:mb-0">
          <Select :model-value="dep.field" :options="candidateOptions" :aria-label="t('schema.conditionField')" @update:model-value="(v) => v && patchDependency(i, { field: v })" />
          <Select :model-value="dep.operator" :options="operatorOptions" :aria-label="t('schema.condition')" @update:model-value="(v) => v && patchDependency(i, { operator: v })" />
          <Button variant="ghost" size="icon" :aria-label="t('common.remove')" @click="removeDependency(i)"><X /></Button>
          <ChipsInput
            v-if="dep.operator !== 'has_value' && dep.operator !== 'is_empty'"
            class="col-span-2"
            :model-value="scalars(dep.values)"
            :placeholder="t('fieldFilter.values')"
            @update:model-value="(v: (string | number)[]) => patchDependency(i, { values: v })"
          />
        </div>
      </section>

      <div class="flex flex-wrap gap-x-6 gap-y-3 rounded-xl bg-muted/40 px-4 py-3 text-sm">
        <label class="flex items-center gap-2" :class="!canBeList && 'opacity-50'">
          <Switch v-model="array" :disabled="!canBeList" size="sm" /> {{ t('schema.multiple') }}
        </label>
        <label class="flex items-center gap-2"><Switch v-model="required" size="sm" /> {{ t('schema.required') }}</label>
        <label class="flex items-center gap-2"><Switch v-model="visible" size="sm" /> {{ t('schema.shownByDefault') }}</label>
      </div>
    </form>
    <template #footer>
      <Button variant="ghost" @click="attemptClose">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :loading="saving" @click="save">{{ t('common.save') }}</Button>
    </template>
  </Dialog>
</template>
