<script setup lang="ts">
/**
 * A horizontal scrollbar pinned to the bottom of the window, mirroring the grid's own (which sits under the
 * last row, off screen on a long page). Two-way synced; hidden when there is nothing to scroll.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ viewport: HTMLElement | null }>()
const bar = ref<HTMLElement>()
const width = ref(0)
const content = ref(0)
const offset = ref(0)
const scrollable = ref(false)
const dir = ref<'ltr' | 'rtl'>('ltr')
let observer: ResizeObserver | null = null
let attached: HTMLElement | null = null

function measure() {
  const vp = props.viewport
  if (!vp || !bar.value) return
  dir.value = getComputedStyle(vp).direction === 'rtl' ? 'rtl' : 'ltr'
  width.value = vp.clientWidth
  content.value = vp.scrollWidth
  const parent = bar.value.parentElement?.getBoundingClientRect()
  offset.value = parent ? Math.max(0, vp.getBoundingClientRect().left - parent.left) : 0
  scrollable.value = vp.scrollWidth - vp.clientWidth >= 1
  requestAnimationFrame(follow)
}
function follow() {
  const vp = props.viewport
  if (vp && bar.value && Math.abs(bar.value.scrollLeft - vp.scrollLeft) >= 1) bar.value.scrollLeft = vp.scrollLeft
}
function lead() {
  const vp = props.viewport
  if (vp && bar.value && Math.abs(vp.scrollLeft - bar.value.scrollLeft) >= 1) vp.scrollLeft = bar.value.scrollLeft
}
function detach() {
  attached?.removeEventListener('scroll', follow)
  observer?.disconnect()
  attached = null
}
function attach(vp: HTMLElement | null) {
  detach()
  if (!vp) return
  attached = vp
  vp.addEventListener('scroll', follow, { passive: true })
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(measure)
    observer.observe(vp)
    if (vp.firstElementChild) observer.observe(vp.firstElementChild)
  }
  measure()
}
watch(() => props.viewport, attach)
onMounted(() => attach(props.viewport))
onBeforeUnmount(detach)
</script>

<template>
  <div
    v-show="scrollable"
    ref="bar"
    aria-hidden="true"
    :dir="dir"
    class="sky-sticky-scroll sticky bottom-0 z-[1] overflow-x-scroll border-t border-border bg-card/95 backdrop-blur"
    :style="{ width: `${width}px`, marginInlineStart: dir === 'ltr' ? `${offset}px` : undefined }"
    @scroll="lead"
  >
    <div :style="{ width: `${content}px`, height: '1px' }" />
  </div>
</template>

<style>
.sky-sticky-scroll { height: 14px; scrollbar-width: thin; }
</style>
