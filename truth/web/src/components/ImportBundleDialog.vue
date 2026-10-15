<script setup lang="ts">
/**
 * Restoring a bundle: what is not already here is written, in three passes - industries, schemas, assumptions -
 * the register re-read between them so each pass can name what the one before created. Industries and schemas
 * are matched by name, assumptions by name and text. A failed write is listed and the rest go on.
 */
import { AlertCircle, FileUp, Upload } from 'lucide-vue-next'
import { Button, Dialog, Progress, notify, reportError, translate as t } from '@truth-platform/ui'
import { computed, ref, watch } from 'vue'
import { createAssumption, createIndustry, createSchema } from '@/api/endpoints'
import { useRegister } from '@/composables/register'
import { assumptionDraft, assumptionKey, nameResolver, readBundle, type Bundle } from '@/lib/bundle'
import { readCreator } from '@/lib/misc'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ restored: [] }>()
const register = useRegister()

const fileName = ref('')
const bundle = ref<Bundle | null>(null)
const unreadable = ref(false)
const running = ref(false)
const finished = ref(false)
const done = ref(0)
const total = ref(0)
const created = ref(0)
const failures = ref<string[]>([])
const input = ref<HTMLInputElement>()

watch(open, (o) => {
  if (!o) return
  fileName.value = ''
  bundle.value = null
  unreadable.value = false
  running.value = false
  finished.value = false
  done.value = total.value = created.value = 0
  failures.value = []
})

/** What will be written: everything whose name (or name and text) the register does not hold. */
const plan = computed(() => {
  const b = bundle.value
  if (!b) return { industries: [], schemas: [], assumptions: [], skipped: 0, total: 0 }
  const heldIndustries = new Set(register.industries.value.map((i) => i.name))
  const heldSchemas = new Set(register.schemas.value.map((s) => s.name))
  const heldAssumptions = new Set(register.assumptions.value.map((a) => assumptionKey(a.name, a.assumption_text)))
  const industries = b.industries.filter((i) => !heldIndustries.has(i.name))
  const schemas = b.schemas.filter((s) => !heldSchemas.has(s.name))
  const assumptions = b.assumptions.filter((a) => !heldAssumptions.has(assumptionKey(a.name, a.assumption_text)))
  return {
    industries,
    schemas,
    assumptions,
    skipped: b.assumptions.length - assumptions.length,
    total: industries.length + schemas.length + assumptions.length,
  }
})

async function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = file.name
  finished.value = false
  failures.value = []
  const parsed = readBundle(await file.text())
  bundle.value = parsed
  unreadable.value = parsed === null
}

async function reread() {
  try {
    await register.load(true)
  } catch (e) {
    reportError(e)
  }
}

async function restore() {
  const p = plan.value
  if (!bundle.value || running.value || p.total === 0) return
  const own = readCreator()
  running.value = true
  finished.value = false
  total.value = p.total
  done.value = created.value = 0
  failures.value = []
  const attempt = async (label: string, write: () => Promise<unknown>) => {
    try {
      await write()
      created.value += 1
    } catch (e) {
      failures.value = [...failures.value, `${label} — ${e instanceof Error ? e.message : String(e)}`]
    } finally {
      done.value += 1
    }
  }
  try {
    for (const i of p.industries) {
      await attempt(i.name, () => createIndustry({ name: i.name, description: i.description, creator: i.creator || own }))
    }
    if (p.industries.length) await reread()
    const industry = nameResolver(register.industries.value)
    for (const s of p.schemas) {
      await attempt(s.name, () =>
        createSchema({
          name: s.name,
          description: s.description,
          type: s.type,
          scheme: s.scheme,
          creator: s.creator || own,
          industries: s.global ? [] : s.industries.map(industry),
          global: s.global,
        }),
      )
    }
    if (p.schemas.length) await reread()
    const resolve = { schema: nameResolver(register.schemas.value), industry: nameResolver(register.industries.value) }
    for (const a of p.assumptions) {
      await attempt(a.name || a.assumption_text, () => createAssumption(assumptionDraft(a, own, resolve)))
    }
    if (created.value > 0) {
      await reread()
      emit('restored')
    }
    const words = { created: created.value, total: total.value, failed: failures.value.length }
    if (failures.value.length) notify(t('import.done', words), 'warning')
    else notify(t('import.doneClean', words))
  } finally {
    running.value = false
    finished.value = true
  }
}

const summary = computed(() => {
  const words = { created: created.value, total: total.value, failed: failures.value.length }
  return failures.value.length ? t('import.done', words) : t('import.doneClean', words)
})
function close(next: boolean) {
  if (!next && running.value) return
  open.value = next
}
</script>

<template>
  <Dialog :open="open" size="lg" :title="t('import.title')" :description="t('import.note')" :persistent="running" @update:open="close">
    <template #icon><Upload /></template>
    <div class="flex flex-col gap-4">
      <div>
        <div class="mb-1.5 text-[13px] font-medium">{{ t('import.pick') }}</div>
        <input ref="input" type="file" accept="application/json,.json" class="sr-only" :disabled="running" @change="onPick" />
        <button
          type="button"
          :disabled="running"
          class="flex w-full items-center gap-3 rounded-xl border border-dashed border-input bg-card px-4 py-4 text-start transition-colors hover:border-primary hover:bg-primary-soft/40 disabled:opacity-60"
          @click="input?.click()"
        >
          <span class="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"><FileUp class="size-4" /></span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium" dir="auto">{{ fileName || t('import.choose') }}</span>
            <span class="block text-xs text-muted-foreground">.json</span>
          </span>
        </button>
      </div>
      <div v-if="unreadable" class="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">
        <AlertCircle class="mt-0.5 size-4 shrink-0" /> {{ t('import.unreadable') }}
      </div>
      <div v-else-if="bundle" class="space-y-1.5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
        <p>{{ t('import.summary', { industries: bundle.industries.length, schemas: bundle.schemas.length, assumptions: bundle.assumptions.length }) }}</p>
        <p class="font-medium">{{ t('import.willCreate', { industries: plan.industries.length, schemas: plan.schemas.length, assumptions: plan.assumptions.length }) }}</p>
        <p v-if="plan.skipped > 0" class="text-muted-foreground">{{ t('import.alreadyHere', { count: plan.skipped }) }}</p>
      </div>
      <div v-if="running || finished" class="space-y-2">
        <Progress :value="done" :max="total || 1" :tone="failures.length ? 'warning' : 'primary'" />
        <p class="text-[13px] text-muted-foreground">
          {{ t('import.running', { done, total }) }}
          <template v-if="finished">{{ summary }}</template>
        </p>
        <div v-if="failures.length" class="rounded-xl border border-border">
          <div class="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">{{ t('import.failures') }}</div>
          <ul class="max-h-40 overflow-y-auto px-3 py-2 text-[13px]">
            <li v-for="(f, i) in failures" :key="i" dir="auto" class="py-0.5">{{ f }}</li>
          </ul>
        </div>
      </div>
    </div>
    <template #footer>
      <Button variant="ghost" :disabled="running" @click="close(false)">{{ t('import.cancel') }}</Button>
      <Button variant="primary" :loading="running" :disabled="!bundle || plan.total === 0" @click="restore">{{ t('import.restore') }}</Button>
    </template>
  </Dialog>
</template>
