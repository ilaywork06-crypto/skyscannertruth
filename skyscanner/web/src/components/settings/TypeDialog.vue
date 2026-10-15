<script setup lang="ts">
/**
 * New / edit event type or entity type: names, key (rename with a dry run), description, industries (none =
 * all). Event types choose the built-in fields they ask for and the declared event fields; entity types an icon.
 */
import { Shapes } from 'lucide-vue-next'
import {
  Button, Combobox, Dialog, Field, Textarea, hasAName, isValidKey, joinNames, localName, notify, reportError, splitNames, toKey,
  translate as t, useDirtyGuard, type ComboOption,
} from '@truth-platform/ui'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import {
  createEntityType, createEventType, invalidateTaxonomy, previewTypeRename, updateEntityType, updateEventType, useIndustries,
  type EntityType, type EventType, type FieldDefinition, type Industry, type OptionalEventField,
} from '@/api/taxonomy'
import { useSettingsRename, useSettingsSnapshot } from '@/composables/useSettingsRename'
import IconPicker from './IconPicker.vue'
import KeyField from './KeyField.vue'
import NameFields from './NameFields.vue'

export type TypeKind = 'event' | 'entity'
const BUILT_IN: OptionalEventField[] = ['event_date', 'experiment_result', 'notes']
const DEFAULT_ENTITY_ICON = 'mdi-chart-timeline-variant'

const props = defineProps<{
  kind: TypeKind
  type: EventType | EntityType | null
  taken: string[]
  eventFields: FieldDefinition[]
  defaultIndustry?: string | null
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [kind: TypeKind] }>()
const client = useQueryClient()
const { industries } = useIndustries()
const rename = useSettingsRename(previewTypeRename)

const english = ref('')
const hebrew = ref('')
const key = ref('')
const description = ref('')
const chosenIndustries = ref<string[]>([])
const fields = ref<OptionalEventField[]>([])
const customFields = ref<string[]>([])
const icon = ref(DEFAULT_ENTITY_ICON)
const tried = ref(false)
const saving = ref(false)

const industryOptions = computed<ComboOption<string>[]>(() => (industries.value as Industry[]).map((i) => ({ value: i.key, label: localName(i) })))
const builtInOptions = computed<ComboOption<OptionalEventField>[]>(() => BUILT_IN.map((f) => ({ value: f, label: t(`types.field.${f}`) })))
const fieldOptions = computed<ComboOption<string>[]>(() => {
  const seen = new Set<string>()
  const out: ComboOption<string>[] = []
  for (const f of props.eventFields) {
    if (seen.has(f.key)) continue
    seen.add(f.key)
    out.push({ value: f.key, label: localName({ name: f.name, name_he: f.metadata.name_he }), hint: f.key })
  }
  // Keys the type asks for but no loaded declaration names (another industry's field) stay choosable.
  for (const k of customFields.value) if (!seen.has(k)) out.push({ value: k, label: k })
  return out
})

const snap = useSettingsSnapshot(() => [english.value, hebrew.value, key.value, description.value, chosenIndustries.value, fields.value, customFields.value, icon.value])
const { attemptClose } = useDirtyGuard({ isDirty: snap.isDirty, close: () => (open.value = false) })
const keyTaken = computed(() => props.taken.filter((k) => k !== props.type?.key))
const locked = computed(() => !!props.type && !rename.unlocked.value)

watch(open, (o) => {
  if (!o) return
  const x = props.type
  const names = x ? splitNames(x) : { english: '', hebrew: '' }
  english.value = names.english
  hebrew.value = names.hebrew
  key.value = x?.key ?? ''
  description.value = x?.description ?? ''
  chosenIndustries.value = x ? [...x.industries] : props.defaultIndustry ? [props.defaultIndustry] : []
  const ev = x && 'fields' in x ? (x as EventType) : null
  fields.value = ev ? [...ev.fields] : x ? [] : ['event_date', 'notes']
  customFields.value = ev ? [...ev.custom_fields] : []
  icon.value = (x && 'icon' in x && (x as EntityType).icon) || DEFAULT_ENTITY_ICON
  tried.value = false
  rename.reset()
  snap.mark()
}, { immediate: true })

watch(english, (now, before) => {
  if (!props.type && key.value === toKey(before ?? '')) key.value = toKey(now)
})

const valid = () =>
  hasAName({ english: english.value, hebrew: hebrew.value }) &&
  (locked.value || (isValidKey(key.value) && !keyTaken.value.includes(key.value.trim()))) &&
  (props.kind === 'event' || /^mdi-[a-z0-9]+(-[a-z0-9]+)*$/.test(icon.value))

async function save() {
  tried.value = true
  if (!valid()) return
  saving.value = true
  const base = { ...joinNames({ english: english.value, hebrew: hebrew.value }), description: description.value.trim(), industries: chosenIndustries.value }
  const moved = !!props.type && key.value.trim() !== props.type.key
  const keyPart = moved ? { key: key.value.trim() } : {}
  try {
    if (props.kind === 'event') {
      const extra = { fields: fields.value, custom_fields: customFields.value }
      if (props.type) await updateEventType(props.type.id, { ...keyPart, ...base, ...extra })
      else await createEventType({ key: key.value.trim(), ...base, order: 100, ...extra })
    } else {
      const extra = { icon: icon.value.trim() || null }
      if (props.type) await updateEntityType(props.type.id, { ...keyPart, ...base, ...extra })
      else await createEntityType({ key: key.value.trim(), ...base, order: 100, ...extra })
    }
    await invalidateTaxonomy(client)
    notify(t('common.saved'), 'success')
    emit('saved', props.kind)
    open.value = false
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}

const title = computed(() => (props.type ? t('types.edit') : props.kind === 'event' ? t('types.newEventTitle') : t('types.newEntityTitle')))
</script>

<template>
  <Dialog v-model:open="open" size="lg" persistent :title="title" @attempt-close="attemptClose">
    <template #icon><Shapes /></template>
    <form class="flex flex-col gap-4" @submit.prevent="save">
      <NameFields v-model:english="english" v-model:hebrew="hebrew" :show-errors="tried" autofocus id-prefix="type" />
      <KeyField
        id="type-key"
        v-model="key"
        :locked="locked"
        renamable
        :taken="keyTaken"
        :show-errors="tried"
        :summary="rename.summary.value"
        :checking="rename.checking.value"
        @unlock="type && rename.start(type.id, type.key)"
      />
      <Field :label="t('common.description')" for="type-description">
        <Textarea id="type-description" v-model="description" rows="2" dir="auto" />
      </Field>
      <Field :label="t('settings.industries')" for="type-industries" :hint="t('settings.emptyMeansAll')">
        <Combobox id="type-industries" v-model="chosenIndustries" multiple :options="industryOptions" :placeholder="t('common.allIndustries')" />
      </Field>
      <template v-if="kind === 'event'">
        <Field :label="t('types.builtInFields')" for="type-builtin">
          <Combobox id="type-builtin" v-model="fields" multiple :options="builtInOptions" :placeholder="'—'" />
        </Field>
        <Field :label="t('types.declaredFields')" for="type-custom">
          <Combobox id="type-custom" v-model="customFields" multiple :options="fieldOptions" :placeholder="'—'" />
        </Field>
      </template>
      <IconPicker v-else id="type-icon" v-model="icon" />
    </form>
    <template #footer>
      <Button variant="ghost" @click="attemptClose">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :loading="saving" @click="save">{{ t('common.save') }}</Button>
    </template>
  </Dialog>
</template>
