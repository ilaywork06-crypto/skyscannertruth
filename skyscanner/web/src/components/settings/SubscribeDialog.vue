<script setup lang="ts">
/**
 * Follow an industry or one event by mail. Opened without a target it asks for the industry. The last mail
 * address used is offered again (`skyscanner.email`).
 */
import { Bell } from 'lucide-vue-next'
import {
  Button, Combobox, Dialog, Field, Input, localName, notify, reportError, storage, translate as t, useDirtyGuard, type ComboOption,
} from '@truth-platform/ui'
import { computed, ref, watch } from 'vue'
import {
  BROAD_DEFAULT_TRIGGERS, EVENT_DEFAULT_TRIGGERS, EVENT_TRIGGERS, SUBSCRIPTION_EMAIL_KEY, SUBSCRIPTION_TRIGGERS, createSubscription,
  type SubscriptionTrigger,
} from '@/api/subscriptions'
import { useIndustries, type Industry } from '@/api/taxonomy'

const props = withDefaults(defineProps<{ eventId?: string | null; industry?: string | null; targetLabel?: string }>(), {
  eventId: null,
  industry: null,
  targetLabel: '',
})
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ subscribed: [] }>()
const { industries } = useIndustries()

const email = ref('')
const chosenIndustry = ref<string | null>(null)
const triggers = ref<SubscriptionTrigger[]>([])
const saving = ref(false)
const opened = ref('')

const eventScoped = computed(() => props.eventId !== null)
const picksIndustry = computed(() => !eventScoped.value && props.industry === null)
const triggerOptions = computed<ComboOption<SubscriptionTrigger>[]>(() =>
  (eventScoped.value ? EVENT_TRIGGERS : SUBSCRIPTION_TRIGGERS).map((x) => ({ value: x, label: t(`subscriptions.trigger.${x}`) })),
)
const industryOptions = computed<ComboOption<string>[]>(() => (industries.value as Industry[]).map((i) => ({ value: i.key, label: localName(i) })))
const canFollow = computed(() => email.value.trim().length > 0 && triggers.value.length > 0 && (!picksIndustry.value || !!chosenIndustry.value))
const snapshot = () => JSON.stringify([email.value, chosenIndustry.value, [...triggers.value].sort()])
const { attemptClose } = useDirtyGuard({ isDirty: () => snapshot() !== opened.value, close: () => (open.value = false) })

watch(open, (o) => {
  if (!o) return
  email.value = storage.get(SUBSCRIPTION_EMAIL_KEY) ?? ''
  chosenIndustry.value = null
  triggers.value = eventScoped.value ? [...EVENT_DEFAULT_TRIGGERS] : [...BROAD_DEFAULT_TRIGGERS]
  opened.value = snapshot()
}, { immediate: true })

async function submit() {
  if (!canFollow.value || saving.value) return
  saving.value = true
  try {
    await createSubscription({
      email: email.value.trim(),
      industry: props.industry ?? chosenIndustry.value,
      event_id: props.eventId,
      event_type_key: null,
      triggers: triggers.value,
    })
    storage.set(SUBSCRIPTION_EMAIL_KEY, email.value.trim())
    notify(t('subscriptions.subscribed'), 'success')
    emit('subscribed')
    open.value = false
  } catch (error) {
    reportError(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open" size="sm" persistent :title="t('subscriptions.followTitle', { target: targetLabel || t('subscriptions.anIndustry') })" @attempt-close="attemptClose">
    <template #icon><Bell /></template>
    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <Field :label="t('subscriptions.mail')" for="subscribe-email">
        <Input id="subscribe-email" v-model="email" type="email" dir="ltr" autocomplete="email" />
      </Field>
      <Field v-if="picksIndustry" :label="t('schema.industry')" for="subscribe-industry">
        <Combobox id="subscribe-industry" v-model="chosenIndustry" :options="industryOptions" :placeholder="t('schema.industry')" />
      </Field>
      <Field :label="t('subscriptions.notifyOn')" for="subscribe-triggers">
        <Combobox id="subscribe-triggers" v-model="triggers" multiple :options="triggerOptions" />
      </Field>
    </form>
    <template #footer>
      <Button variant="ghost" @click="attemptClose">{{ t('common.cancel') }}</Button>
      <Button variant="primary" :loading="saving" :disabled="!canFollow" @click="submit">{{ t('subscriptions.follow') }}</Button>
    </template>
  </Dialog>
</template>
