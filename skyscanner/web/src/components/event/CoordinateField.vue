<script setup lang="ts">
/**
 * A point on the globe (spec core-ui §5.15): a Leaflet map when the deployment names a tile server (click to
 * pick), and the latitude / longitude / altitude boxes. Half-typed numbers are kept while typing.
 */
import 'leaflet/dist/leaflet.css'
import { X } from 'lucide-vue-next'
import { Button, Input, buildCoordinate, mapTiles, toCoordinate, translate as t, PICKED_ZOOM, DEFAULT_CENTER, DEFAULT_ZOOM } from '@truth-platform/ui'
import type { CircleMarker, LeafletMouseEvent, Map as LeafletMap } from 'leaflet'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

type Coordinate = { lon: number; lat: number; alt: number | null }
const props = withDefaults(defineProps<{ modelValue: unknown; label?: string; readonly?: boolean }>(), { label: 'the coordinate', readonly: false })
const emit = defineEmits<{ 'update:modelValue': [value: Coordinate | null] }>()

const tiles = mapTiles()
const point = computed(() => toCoordinate(props.modelValue))
const typed = ref<Partial<Record<'lat' | 'lon' | 'alt', string>>>({})
const box = (part: 'lat' | 'lon' | 'alt') => typed.value[part] ?? (point.value ? (point.value[part] === null ? '' : String(point.value[part])) : '')

function onType(part: 'lat' | 'lon' | 'alt', value: string | number | null | undefined) {
  if (props.readonly) return
  typed.value = { ...typed.value, [part]: value === null || value === undefined ? '' : String(value) }
  const lat = box('lat')
  const lon = box('lon')
  const alt = box('alt')
  if (lat === '' || lon === '') return emit('update:modelValue', null)
  const built = buildCoordinate(Number(lon), Number(lat), alt === '' ? null : Number(alt))
  emit('update:modelValue', built ? { ...built } : null)
}
function clear() {
  typed.value = {}
  emit('update:modelValue', null)
}

const canvas = ref<HTMLElement>()
let map: LeafletMap | null = null
let marker: CircleMarker | null = null
let L: typeof import('leaflet') | null = null

const round = (n: number) => Math.round(n * 1e5) / 1e5
function onMapClick(e: LeafletMouseEvent) {
  if (props.readonly) return
  const alt = box('alt')
  const built = buildCoordinate(round(e.latlng.lng), round(e.latlng.lat), alt === '' ? null : Number(alt))
  if (!built) return
  typed.value = {}
  emit('update:modelValue', { ...built })
}
function paint() {
  if (!map || !L) return
  const p = point.value
  if (!p) {
    marker?.remove()
    marker = null
    return
  }
  if (!marker) {
    marker = L.circleMarker([p.lat, p.lon], { radius: 7, weight: 2 }).addTo(map)
    map.setView([p.lat, p.lon], Math.max(map.getZoom(), PICKED_ZOOM))
  } else marker.setLatLng([p.lat, p.lon])
}
watch(
  canvas,
  async (el) => {
    if (!el || map || !tiles.url) return
    L = await import('leaflet')
    map = L.map(el).setView(DEFAULT_CENTER, DEFAULT_ZOOM)
    L.tileLayer(tiles.url, { attribution: tiles.attribution }).addTo(map)
    map.on('click', onMapClick)
    paint()
  },
  { immediate: true, flush: 'post' },
)
watch(point, paint)
onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="tiles.url" ref="canvas" role="application" :aria-label="t('input.pickOnMap', { name: label })" class="relative z-0 h-56 overflow-hidden rounded-xl border border-border" />
    <p v-else-if="!readonly" class="text-xs text-muted-foreground">{{ t('input.noMap') }}</p>
    <div class="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" dir="ltr">
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">{{ t('input.latitude') }}
        <Input type="number" step="0.00001" :readonly="readonly" :model-value="box('lat')" @update:model-value="(v) => onType('lat', v)" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">{{ t('input.longitude') }}
        <Input type="number" step="0.00001" :readonly="readonly" :model-value="box('lon')" @update:model-value="(v) => onType('lon', v)" />
      </label>
      <label class="flex flex-col gap-1 text-xs text-muted-foreground">{{ t('input.altitude') }}
        <Input type="number" :readonly="readonly" :model-value="box('alt')" @update:model-value="(v) => onType('alt', v)" />
      </label>
      <Button v-if="!readonly" size="icon" variant="ghost" :disabled="!point" :aria-label="t('input.clearCoordinate')" @click="clear"><X /></Button>
    </div>
  </div>
</template>
