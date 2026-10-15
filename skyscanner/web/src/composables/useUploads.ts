/**
 * Upload state for dialogs: the summed progress of several picks (each pick gets its own reporter, so three
 * picks running side by side never make the bar jump backwards) and a reactive pause / resume / cancel switch.
 */
import { formatBytes, translate as t } from '@truth-platform/ui'
import { computed, ref, shallowRef } from 'vue'
import { UploadControl, type UploadProgress } from '@/api/uploads'

/** Below this a pick lands too quickly for a bar to inform rather than flash. */
export const WORTH_SHOWING_BYTES = 8 * 1024 * 1024

export function useUploadProgress() {
  const sources = ref<UploadProgress[]>([])

  /** A reporter for one pick, handed to `uploadArtifacts({ onProgress })`. */
  const track = (): ((update: UploadProgress) => void) => {
    const slot = sources.value.length
    sources.value = [...sources.value, { written: 0, total: 0, name: '' }]
    return (update) => {
      const next = [...sources.value]
      next[slot] = { ...update }
      sources.value = next
    }
  }
  const reset = () => {
    sources.value = []
  }

  const written = computed(() => sources.value.reduce((s, x) => s + x.written, 0))
  const total = computed(() => sources.value.reduce((s, x) => s + x.total, 0))
  const visible = computed(() => total.value >= WORTH_SHOWING_BYTES)
  const percent = computed(() => (total.value === 0 ? 0 : Math.min((written.value / total.value) * 100, 100)))
  const label = computed(() => {
    const working = sources.value.find((s) => s.total > 0 && s.written < s.total)
    const head = t('uploads.progress', { written: formatBytes(written.value), total: formatBytes(total.value) })
    return working?.name ? `${head} · ${working.name}` : head
  })

  return { track, reset, written, total, visible, percent, label }
}

/** A reactive face on `UploadControl`: a fresh control per run, `paused` / `running` for the buttons. */
export function useUploadControl() {
  const control = shallowRef<UploadControl | null>(null)
  const paused = ref(false)
  const running = computed(() => control.value !== null)

  const start = (): UploadControl => {
    control.value = new UploadControl()
    paused.value = false
    return control.value
  }
  const pause = () => {
    control.value?.pause()
    paused.value = true
  }
  const resume = () => {
    control.value?.resume()
    paused.value = false
  }
  const cancel = (keepOpen = false) => {
    control.value?.cancel(keepOpen)
    paused.value = false
  }
  const finish = () => {
    control.value = null
    paused.value = false
  }
  return { control, paused, running, start, pause, resume, cancel, finish }
}
