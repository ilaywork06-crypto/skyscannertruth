<script setup lang="ts">
/**
 * A point: latitude / longitude / altitude boxes, and a map to click on when a tile server is configured
 * (VITE_MAP_TILE_URL). Emits `{lon, lat, alt}` or null; half-typed numbers are kept in the boxes.
 */
import { X } from 'lucide-vue-next'
import { Button, Input, buildCoordinate, mapTiles, toCoordinate, translate as t, DEGREE_DECIMALS, PICKED_ZOOM } from '@truth-platform/ui'
import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import type { JsonValue } from '@/api/taxonomy'

const props = defineProps<{ modelValue: JsonValue | undefined; label?: string; readonly?: boolean; id?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: JsonValue] }>()

type Part = 'lat' | 'lon' | 'alt'
const typed = reactive<Partial<Record<Part, string>>>({})
const point = computed(() => toCoordinate(props.modelValue))
const tiles = mapTiles()
const canvas = ref<HTMLDivElement>()

function shown(part: Part): string {
  if (typed[part] !== undefined) return typed[part]!
  const p = point.value
  if (!p) return ''
  const v = p[part]
  return v === null || v === undefined ? '' : String(v)
}

function onType(part: Part, value: string | number | null | undefined) {
  if (props.readonly) return
  typed[part] = value === null || value === undefined ? '' : String(value)
  const lat = shown('lat')
  const lon = shown('lon')
  const alt = shown('alt')
  if (!lat.trim() || !lon.trim()) return emit('update:modelValue', null)
  const built = buildCoordinate(Number(lon), Number(lat), alt.trim() ? Number(alt) : null)
  emit('update:modelValue', built ? { ...built } : null)
}

function clear() {
  for (const k of Object.keys(typed) as Part[]) delete typed[k]
  emit('update:modelValue', null)
}

/* ------------------------------------------------------------- the map */
const round = (n: number) => Number(n.toFixed(DEGREE_DECIMALS))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const map = shallowRef<any>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let marker: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let L: any = null

async function build() {
  if (!canvas.value || map.value || !tiles.url) return
  L = await import('leaflet')
  await import('leaflet/dist/leaflet.css')
  map.value = L.map(canvas.value).setView([0, 0], 2)
  L.tileLayer(tiles.url, { attribution: tiles.attribution }).addTo(map.value)
  map.value.on('click', (e: { latlng: { lat: number; lng: number } }) => {
    if (props.readonly) return
    const alt = shown('alt')
    const built = buildCoordinate(round(e.latlng.lng), round(e.latlng.lat), alt.trim() ? Number(alt) : null)
    if (!built) return
    for (const k of Object.keys(typed) as Part[]) delete typed[k]
    emit('update:modelValue', { ...built })
  })
  paint()
}

function paint() {
  if (!map.value || !L) return
  const p = point.value
  if (!p) {
    marker?.remove()
    marker = null
    return
  }
  if (!marker) {
    marker = L.circleMarker([p.lat, p.lon], { radius: 7, weight: 2 }).addTo(map.value)
    map.value.setView([p.lat, p.lon], Math.max(map.value.getZoom(), PICKED_ZOOM))
  } else marker.setLatLng([p.lat, p.lon])
}

watch(canvas, build, { immediate: true, flush: 'post' })
watch(point, paint)
onBeforeUnmount(() => map.value?.remove())
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-if="tiles.url"
      ref="canvas"
      role="application"
      :aria-label="t('input.pickOnMap', { name: label ?? '' })"
      class="z-0 h-56 overflow-hidden rounded-xl border border-border"
    />
    <p v-else class="text-xs text-muted-foreground">{{ t('input.noMap') }}</p>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" dir="ltr">
      <Input
        :id="id"
        type="number"
        step="0.00001"
        :placeholder="t('input.latitude')"
        :aria-label="t('input.latitude')"
        :readonly="readonly"
        :model-value="shown('lat')"
        @update:model-value="(v) => onType('lat', v)"
      />
      <Input
        type="number"
        step="0.00001"
        :placeholder="t('input.longitude')"
        :aria-label="t('input.longitude')"
        :readonly="readonly"
        :model-value="shown('lon')"
        @update:model-value="(v) => onType('lon', v)"
      />
      <Input
        type="number"
        :placeholder="t('input.altitude')"
        :aria-label="t('input.altitude')"
        :readonly="readonly"
        :model-value="shown('alt')"
        @update:model-value="(v) => onType('alt', v)"
      />
      <Button
        v-if="!readonly"
        variant="ghost"
        size="icon"
        :disabled="!point"
        :aria-label="t('input.clearCoordinate')"
        @click="clear"
      >
        <X />
      </Button>
    </div>
  </div>
</template>
