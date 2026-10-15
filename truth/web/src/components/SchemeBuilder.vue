<script setup lang="ts">
/**
 * The attributes of a schema, one card each: key, kind, flags, names in both languages, and what the kind calls
 * for (options for an enumeration, bounds for a number). The key follows the English name until somebody types
 * a key of their own. A field that already is ULTRA ENUM or MULTI FIELD keeps its kind on offer, so revising
 * the schema around it never turns it into something else.
 */
import { Plus, Trash2 } from 'lucide-vue-next'
import {
  Badge, Button, EmptyState, Field, Input, Select, Switch, Tooltip, isValidKey, toKey, translate as t, type SelectOption,
} from '@truth-platform/ui'
import { ref } from 'vue'
import {
  OFFERED_TYPES, fieldNames, fieldProblem, hasOptions, isNumeric, newField, typeLabel, withNames,
  type SchemeField, type SchemeFieldType,
} from '@/lib/scheme'
import TagInput from './TagInput.vue'

const fields = defineModel<SchemeField[]>({ default: () => [] })
/** Which fields have been renamed at least once - their "write a name" complaint may show. */
const touched = ref<boolean[]>([])

function update(i: number, change: Partial<SchemeField>) {
  fields.value = fields.value.map((f, at) => (at === i ? { ...f, ...change } : f))
}
function add() {
  fields.value = [...fields.value, newField(fields.value.length)]
  touched.value = [...touched.value, false]
}
function remove(i: number) {
  fields.value = fields.value.filter((_, at) => at !== i)
  touched.value = touched.value.filter((_, at) => at !== i)
}

function typeOptions(f: SchemeField): SelectOption<SchemeFieldType>[] {
  const types = OFFERED_TYPES.includes(f.type) ? OFFERED_TYPES : [...OFFERED_TYPES, f.type]
  return types.map((v) => ({ value: v, label: typeLabel(v) }))
}
function setType(i: number, type: SchemeFieldType | null | undefined) {
  if (!type || type === fields.value[i].type) return
  update(i, { type, options: [], min: null, max: null, step: null })
}

function setName(i: number, side: 'english' | 'hebrew', value: string) {
  const f = fields.value[i]
  const names = fieldNames(f)
  const following = f.key === '' || f.key === toKey(names.english)
  const next = withNames(f, { ...names, [side]: value })
  touched.value = fields.value.map((_, at) => (at === i ? true : !!touched.value[at]))
  fields.value = fields.value.map((x, at) => (at === i ? { ...next, key: side === 'english' && following ? toKey(value) : f.key } : x))
}

function setBound(i: number, which: 'min' | 'max' | 'step', raw: string | number | null | undefined) {
  const f = fields.value[i]
  const text = raw === null || raw === undefined ? '' : String(raw).trim()
  let n: number | null = text === '' ? null : Number(text)
  if (n !== null && Number.isNaN(n)) n = null
  if (n !== null && f.type === 'confined_number') n = Math.round(n)
  update(i, { [which]: n })
}

const others = (i: number) => fields.value.filter((_, at) => at !== i).map((o) => o.key.trim())
function keyError(i: number): string | null {
  const key = fields.value[i].key.trim()
  if (!key) return null
  if (!isValidKey(key)) return t('names.keyEnglish')
  if (others(i).includes(key)) return t('names.keyTaken')
  return null
}
function nameError(i: number): string | null {
  const f = fields.value[i]
  const names = fieldNames(f)
  if (names.english.trim() || names.hebrew.trim()) return null
  return f.key.trim() || touched.value[i] ? t('names.required') : null
}
const optionsError = (i: number) => (hasOptions(fields.value[i].type) && !fields.value[i].options.length ? t('schemas.optionsRequired') : null)
const problemOf = (i: number) => fieldProblem(fields.value[i], others(i))
function displayOf(f: SchemeField): string {
  const n = fieldNames(f)
  return n.english || n.hebrew || f.key || t('schemas.thisAttribute')
}
</script>

<template>
  <section>
    <div class="mb-3 flex items-center gap-2">
      <h4 class="text-sm font-semibold">{{ t('schemas.attributes') }}</h4>
      <Badge>{{ fields.length }}</Badge>
      <Button class="ms-auto" size="sm" variant="soft" @click="add"><Plus /> {{ t('schemas.addAttribute') }}</Button>
    </div>
    <EmptyState v-if="!fields.length" compact :title="t('schemas.firstAttribute')" class="rounded-xl border border-dashed border-border" />
    <ol class="flex flex-col gap-3">
      <li
        v-for="(f, i) in fields"
        :key="i"
        :class="['rounded-xl border bg-card p-4 shadow-soft', problemOf(i) && touched[i] ? 'border-danger/40' : 'border-border']"
      >
        <div class="flex flex-wrap items-start gap-3">
          <span class="mt-7 grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">{{ i + 1 }}</span>
          <Field :label="t('schemas.key')" :error="keyError(i)" :hint="!f.key.trim() ? t('names.keyEnglish') : undefined" class="min-w-[10rem] flex-1" :for="`key-${i}`">
            <Input :id="`key-${i}`" :model-value="f.key" dir="ltr" class="mono" :invalid="!!keyError(i)" @update:model-value="(v) => update(i, { key: String(v ?? '') })" />
          </Field>
          <Field :label="t('schemas.type')" class="w-40" :for="`type-${i}`">
            <Select :id="`type-${i}`" :model-value="f.type" :options="typeOptions(f)" @update:model-value="(v) => setType(i, v)" />
          </Field>
          <Field :label="t('schemas.required')" class="items-start">
            <div class="flex h-9 items-center"><Switch :model-value="f.required" @update:model-value="(v) => update(i, { required: v })" /></div>
          </Field>
          <Field :label="t('schemas.many')" class="items-start">
            <div class="flex h-9 items-center"><Switch :model-value="f.array" @update:model-value="(v) => update(i, { array: v })" /></div>
          </Field>
          <Tooltip :content="t('schemas.removeAttribute', { name: displayOf(f) })">
            <Button class="mt-6" size="icon-sm" variant="ghost" :aria-label="t('schemas.removeAttribute', { name: displayOf(f) })" @click="remove(i)">
              <Trash2 class="text-danger" />
            </Button>
          </Tooltip>
        </div>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <Field :label="t('names.english')" :for="`en-${i}`" :error="nameError(i)">
            <Input :id="`en-${i}`" :model-value="fieldNames(f).english" dir="ltr" :invalid="!!nameError(i)" @update:model-value="(v) => setName(i, 'english', String(v ?? ''))" />
          </Field>
          <Field :label="t('names.hebrew')" :for="`he-${i}`">
            <Input :id="`he-${i}`" :model-value="fieldNames(f).hebrew" dir="rtl" :invalid="!!nameError(i)" @update:model-value="(v) => setName(i, 'hebrew', String(v ?? ''))" />
          </Field>
        </div>
        <Field v-if="hasOptions(f.type)" class="mt-3" :label="t('schemas.options')" :error="optionsError(i)" :for="`options-${i}`">
          <TagInput :id="`options-${i}`" :model-value="f.options" :invalid="!!optionsError(i)" @update:model-value="(v) => update(i, { options: v })" />
        </Field>
        <div v-else-if="isNumeric(f.type)" class="mt-3 grid grid-cols-3 gap-3">
          <Field v-for="b in (['min', 'max', 'step'] as const)" :key="b" :label="t(`schemas.${b}`)" :for="`${b}-${i}`">
            <Input
              :id="`${b}-${i}`"
              type="number"
              dir="ltr"
              :step="f.type === 'confined_number' ? 1 : 'any'"
              :model-value="f[b] ?? ''"
              :placeholder="t('schemas.optional')"
              @update:model-value="(v) => setBound(i, b, v)"
            />
          </Field>
        </div>
      </li>
    </ol>
  </section>
</template>
