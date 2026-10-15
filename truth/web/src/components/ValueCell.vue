<script setup lang="ts">
/** A declared value outside the grid, drawn the way its column draws it. */
import { CheckCircle2, MinusCircle } from 'lucide-vue-next'
import { Badge, EMPTY_PLACEHOLDER, LinkedText, formatDate, valueDirection } from '@truth-platform/ui'
import { computed } from 'vue'
import type { JsonValue } from '@/models'
import { renderType, type SchemeField } from '@/lib/scheme'

const props = defineProps<{ field: SchemeField; value: JsonValue | undefined }>()
const kind = computed(() => renderType(props.field.type))
const empty = computed(() => props.value === null || props.value === undefined || props.value === '' || (Array.isArray(props.value) && !props.value.length))
const items = computed(() => (Array.isArray(props.value) ? props.value : [props.value]).filter((v) => v !== null && v !== undefined && v !== ''))
const text = (v: JsonValue | undefined) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v))
</script>

<template>
  <span v-if="empty && kind !== 'boolean'" class="text-muted-foreground/60">{{ EMPTY_PLACEHOLDER }}</span>
  <span v-else-if="field.array" class="flex flex-wrap gap-1">
    <Badge v-for="(v, i) in items" :key="i"><span dir="auto">{{ kind === 'date' ? formatDate(text(v)) : text(v) }}</span></Badge>
  </span>
  <template v-else-if="kind === 'boolean'">
    <CheckCircle2 v-if="value === true || value === 'true'" class="size-4 text-success" />
    <MinusCircle v-else class="size-4 text-muted-foreground/60" />
  </template>
  <span v-else-if="kind === 'date'" dir="ltr" class="tabular-nums">{{ formatDate(text(value)) }}</span>
  <Badge v-else-if="kind === 'enum'"><span dir="auto">{{ text(value) }}</span></Badge>
  <pre v-else-if="kind === 'json'" dir="ltr" class="mono max-h-48 overflow-auto whitespace-pre-wrap text-xs">{{ JSON.stringify(value, null, 2) }}</pre>
  <span v-else :dir="valueDirection(text(value))" class="[unicode-bidi:plaintext]"><LinkedText :text="text(value)" /></span>
</template>
