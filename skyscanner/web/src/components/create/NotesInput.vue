<script setup lang="ts">
/** A list of one-line notes stored as one string joined by "\n". A row is added only after a written one. */
import { Plus, X } from 'lucide-vue-next'
import { Button, Input, translate as t } from '@truth-platform/ui'
import { computed } from 'vue'

const props = defineProps<{ placeholder?: string; addLabel?: string; id?: string }>()
const model = defineModel<string>({ default: '' })

const rows = computed(() => (model.value ?? '').split('\n'))
const canAdd = computed(() => (rows.value[rows.value.length - 1] ?? '').trim().length > 0)
const canRemove = computed(() => rows.value.length > 1 || (model.value ?? '').length > 0)

function edit(i: number, value: string | number | null | undefined) {
  model.value = rows.value.map((r, j) => (j === i ? String(value ?? '') : r)).join('\n')
}
function add() {
  if (canAdd.value) model.value = [...rows.value, ''].join('\n')
}
function remove(i: number) {
  const left = rows.value.filter((_, j) => j !== i)
  model.value = left.length ? left.join('\n') : ''
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div v-for="(row, i) in rows" :key="i" class="flex items-center gap-1.5">
      <Input
        :id="i === 0 ? props.id : undefined"
        :model-value="row"
        dir="auto"
        :placeholder="placeholder || t('input.notesPlaceholder')"
        :aria-label="t('input.note', { number: i + 1 })"
        @update:model-value="(v) => edit(i, v)"
        @keydown.enter.prevent="add"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="!canRemove"
        :aria-label="t('input.removeNote', { number: i + 1 })"
        @click="remove(i)"
      >
        <X />
      </Button>
    </div>
    <div>
      <Button variant="ghost" size="xs" :disabled="!canAdd" @click="add"><Plus /> {{ addLabel || t('input.addNote') }}</Button>
    </div>
  </div>
</template>
