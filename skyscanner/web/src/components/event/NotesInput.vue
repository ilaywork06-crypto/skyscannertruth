<script setup lang="ts">
/** Notes as a list of one-line entries, stored as one string joined by newlines. */
import { Plus, X } from 'lucide-vue-next'
import { Button, Input, translate as t } from '@truth-platform/ui'
import { computed } from 'vue'

const model = defineModel<string>({ default: '' })
const rows = computed(() => model.value.split('\n'))
const canAdd = computed(() => (rows.value[rows.value.length - 1] ?? '').trim() !== '')
const canRemove = computed(() => rows.value.length > 1 || model.value.length > 0)

function edit(i: number, v: string | number | null | undefined) {
  const next = [...rows.value]
  next[i] = v === null || v === undefined ? '' : String(v)
  model.value = next.join('\n')
}
function remove(i: number) {
  const next = rows.value.filter((_, k) => k !== i)
  model.value = next.length ? next.join('\n') : ''
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div v-for="(r, i) in rows" :key="i" class="flex items-center gap-1.5">
      <Input :model-value="r" dir="auto" :placeholder="t('input.notesPlaceholder')" :aria-label="t('input.note', { number: i + 1 })" @update:model-value="(v) => edit(i, v)" />
      <Button size="icon" variant="ghost" :disabled="!canRemove" :aria-label="t('input.removeNote', { number: i + 1 })" @click="remove(i)"><X /></Button>
    </div>
    <Button size="xs" variant="ghost" class="self-start" :disabled="!canAdd" @click="model = `${model}\n`"><Plus /> {{ t('input.addNote') }}</Button>
  </div>
</template>
