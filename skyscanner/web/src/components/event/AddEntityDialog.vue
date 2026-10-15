<script setup lang="ts">
/**
 * Add an entity to an event, or edit one (spec §6.7). The entity sub-form is the create wizard's; in edit mode
 * the stored files can be kept or detached and a reason is required. Picks are uploaded first; a refused save
 * takes them back out of storage.
 */
import { Boxes, Pencil } from 'lucide-vue-next'
import { Button, Dialog, Field, Input, Progress, notify, reportError, translate as t, useDirtyGuard } from '@truth-platform/ui'
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref, watch } from 'vue'
import { discardIfRefused, uploadArtifacts, type Artifact } from '@/api/artifacts'
import {
  createEntity, metadataTypes, metadataValues, toMetadataAttributes, updateEntity, type EntityResponse, type EventDetail,
} from '@/api/events'
import { TAXONOMY_KEYS, listEntityTypes, listFields, listIndustries, type EntityType, type FieldDefinition } from '@/api/taxonomy'
import { useUploadProgress } from '@/composables/useUploads'
import { collisionMessage } from '@/lib/events'
import EntityFormFields from '@/components/create/EntityFormFields.vue'
import { describeEntityForm, emptyEntityForm, type EntityFormValue } from '@/components/create/entityForm'
import StoredFilesEditor from './StoredFilesEditor.vue'

const props = withDefaults(
  defineProps<{ event: EventDetail | null; entity?: EntityResponse | null; defaultTypeKey?: string | null; lockType?: boolean }>(),
  { entity: null, defaultTypeKey: null, lockType: false },
)
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [entity: EntityResponse] }>()
const queryClient = useQueryClient()

const form = ref<EntityFormValue>(emptyEntityForm())
const entityTypes = ref<EntityType[]>([])
const fields = ref<FieldDefinition[]>([])
const modules = ref<string[]>([])
const keptRaw = ref<Artifact[]>([])
const keptParsed = ref<Artifact[]>([])
const keptProducts = ref<Artifact[]>([])
const reason = ref('')
const saving = ref(false)
const tried = ref(false)
const progress = useUploadProgress()
let snapshot = ''
const editing = computed(() => !!props.entity)
const context = computed(() => metadataValues(props.event?.metadata))

function state() {
  return JSON.stringify({
    form: describeEntityForm(form.value),
    kept: [keptRaw.value, keptParsed.value, keptProducts.value].map((l) => l.map((a) => a.id)),
  })
}

async function fill() {
  const e = props.event
  if (!e) return
  reason.value = ''
  tried.value = false
  progress.reset()
  const en = props.entity
  keptRaw.value = en ? [...en.raw_files] : []
  keptParsed.value = en ? [...en.parsed_files] : []
  keptProducts.value = en ? [...en.parsed_additional_files] : []
  form.value = en
    ? {
        ...emptyEntityForm(),
        typeKey: en.object_type_key || null,
        name: en.name,
        module: en.module,
        codeVersion: en.code_version ?? '',
        status: en.status,
        notes: en.notes ?? '',
        values: metadataValues(en.metadata),
        valueTypes: metadataTypes(en.metadata),
      }
    : emptyEntityForm()
  snapshot = state()
  try {
    const [types, industries] = await Promise.all([
      listEntityTypes(e.industry),
      queryClient.fetchQuery({ queryKey: TAXONOMY_KEYS.industries, queryFn: listIndustries }),
    ])
    entityTypes.value = types
    modules.value = industries.find((i) => i.key === e.industry)?.modules ?? []
    if (!en) {
      const preset = props.defaultTypeKey
      const match = preset ? types.find((x) => x.key === preset || x.name === preset) : undefined
      form.value = { ...form.value, typeKey: (match ?? types[0])?.key ?? null }
      snapshot = state()
    }
  } catch (err) {
    reportError(err)
  }
}
watch(open, (o) => o && fill(), { immediate: true })

watch(
  () => [open.value, form.value.typeKey] as const,
  async ([o, typeKey]) => {
    if (!o || !props.event) return
    try {
      fields.value = await listFields({ scope: 'entity', industry: props.event.industry, entity_type: typeKey, include_shared: true })
    } catch (err) {
      reportError(err)
    }
  },
)

const dirty = computed(() => state() !== snapshot)
const duplicates = computed(() =>
  [
    collisionMessage(keptRaw.value, form.value.rawFiles, 'raw_files', 'Raw files'),
    collisionMessage(keptParsed.value, form.value.parsedFiles, 'parsed_files', 'Parsed files'),
    collisionMessage(keptProducts.value, form.value.parsedAdditionalFiles, 'parsed_additional_files', 'Additional parsing products'),
  ].filter(Boolean),
)
const blocked = computed(() => {
  if (!form.value.typeKey || !form.value.name.trim()) return t('entities.nameMissing')
  if (duplicates.value.length) return t('edit.duplicateFiles')
  if (editing.value && !dirty.value) return t('edit.nothingChanged')
  if (editing.value && !reason.value.trim()) return t('edit.reasonMissing')
  return ''
})
const guard = useDirtyGuard({ isDirty: () => dirty.value || !!reason.value.trim(), close: () => (open.value = false) })

async function submit() {
  const e = props.event
  tried.value = true
  if (!e || blocked.value) return
  saving.value = true
  let uploaded: Artifact[] = []
  try {
    const f = form.value
    const pick = (files: File[], kind: 'raw' | 'parsed' | 'parsed_additional', folder: string, descriptor: string) =>
      uploadArtifacts(files, { ownerKind: 'entities', ownerId: e.id, kind, folder, descriptor, onProgress: progress.track() })
    const results = await Promise.allSettled([
      pick(f.rawFiles, 'raw', 'raw_files', 'Raw files of the entity'),
      pick(f.parsedFiles, 'parsed', 'parsed_files', 'Parsed files of the entity'),
      pick(f.parsedAdditionalFiles, 'parsed_additional', 'parsed_additional_files', 'Extra products of the parsing'),
    ])
    uploaded = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
    if (failed) throw failed.reason
    const [raw, parsed, products] = results.map((r) => (r as PromiseFulfilledResult<Artifact[]>).value)
    const metadata = toMetadataAttributes(f.values, f.valueTypes)
    let saved: EntityResponse
    if (props.entity) {
      saved = await updateEntity(e.id, props.entity.id, {
        reason: reason.value.trim(),
        name: f.name.trim(),
        module: f.module,
        code_version: f.codeVersion.trim() || null,
        status: f.status,
        notes: f.notes,
        raw_files: [...keptRaw.value, ...raw],
        parsed_files: [...keptParsed.value, ...parsed],
        parsed_additional_files: [...keptProducts.value, ...products],
        metadata,
      })
      notify(t('entities.saved'))
    } else {
      saved = await createEntity(e.id, {
        name: f.name.trim(),
        entity_type_key: f.typeKey!,
        module: f.module,
        code_version: f.codeVersion.trim() || null,
        status: f.status,
        notes: f.notes,
        upload_source: 'manual',
        requested_at: null,
        received_at: null,
        raw_files: raw,
        parsed_files: parsed,
        parsed_additional_files: products,
        metadata,
      })
      notify(t('entities.added'))
    }
    emit('saved', saved)
    open.value = false
  } catch (err) {
    discardIfRefused(err, uploaded)
    reportError(err)
  } finally {
    saving.value = false
    progress.reset()
  }
}
</script>

<template>
  <Dialog v-model:open="open" size="xl" persistent :title="editing ? t('entities.edit') : t('detail.addEntity')" @attempt-close="guard.attemptClose">
    <template #icon><Pencil v-if="editing" /><Boxes v-else /></template>
    <div class="flex flex-col gap-5">
      <EntityFormFields
        v-model="form"
        :entity-types="entityTypes"
        :fields="fields"
        :modules="modules"
        :lock-type="editing || lockType"
        :stored-parsed-count="keptParsed.length"
        :context="context"
        :show-errors="tried"
        id-prefix="entity-dialog"
      />
      <div v-if="editing" class="grid gap-4 md:grid-cols-3">
        <StoredFilesEditor v-model:kept="keptRaw" :stored="entity?.raw_files ?? []" :label="t('entityForm.rawFiles')" />
        <StoredFilesEditor v-model:kept="keptParsed" :stored="entity?.parsed_files ?? []" :label="t('entityForm.parsedFiles')" />
        <StoredFilesEditor v-model:kept="keptProducts" :stored="entity?.parsed_additional_files ?? []" :label="t('entityForm.parsedAdditionalFiles')" />
      </div>
      <p v-for="d in duplicates" :key="d" class="text-xs text-danger" dir="auto">{{ d }}</p>
      <Field v-if="editing" :label="t('edit.reason')" required for="entity-reason">
        <Input id="entity-reason" v-model="reason" dir="auto" />
      </Field>
    </div>
    <template #footer>
      <div v-if="progress.visible.value" class="me-auto flex min-w-48 flex-1 flex-col gap-1">
        <Progress :value="progress.percent.value" />
        <span class="truncate text-xs text-muted-foreground" dir="auto">{{ progress.label.value }}</span>
      </div>
      <span v-else-if="blocked" class="me-auto text-xs text-muted-foreground">{{ blocked }}</span>
      <Button variant="ghost" :disabled="saving" @click="guard.attemptClose">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :loading="saving" :disabled="!!blocked" @click="submit">{{ editing ? t('common.save') : t('create.add') }}</Button>
    </template>
  </Dialog>
</template>
