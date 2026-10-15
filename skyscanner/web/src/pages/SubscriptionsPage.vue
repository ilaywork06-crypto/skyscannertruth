<script setup lang="ts">
/** Subscriptions (behind SUBSCRIPTIONS_ENABLED) - what this user follows by mail; follow an industry, stop following. */
import { Bell, BellOff, Plus } from 'lucide-vue-next'
import {
  Badge, Button, Card, CardHeader, PageHeader, TH, formatDateTime, localName, notify, reportError, translate as t, useConfirm,
} from '@truth-platform/ui'
import { onMounted, ref } from 'vue'
import { deleteSubscription, listSubscriptions, type Subscription } from '@/api/subscriptions'
import { useIndustries } from '@/api/taxonomy'
import SettingsTableState from '@/components/settings/SettingsTableState.vue'
import SubscribeDialog from '@/components/settings/SubscribeDialog.vue'

const confirm = useConfirm()
const { find } = useIndustries()
const subscriptions = ref<Subscription[]>([])
const loading = ref(true)
const dialogOpen = ref(false)

async function reload() {
  loading.value = true
  try {
    subscriptions.value = await listSubscriptions()
  } catch (error) {
    reportError(error)
  } finally {
    loading.value = false
  }
}
onMounted(reload)

async function remove(s: Subscription) {
  const ok = await confirm({ title: t('subscriptions.stopTitle'), description: s.email, confirmLabel: t('subscriptions.stop'), danger: true })
  if (!ok) return
  try {
    await deleteSubscription(s.id)
    notify(t('subscriptions.stopped'), 'success')
    await reload()
  } catch (error) {
    reportError(error)
  }
}
const industryName = (key: string) => {
  const i = find(key)
  return i ? localName(i) : key
}
</script>

<template>
  <div>
    <PageHeader :title="t('app.subscriptions')" :description="t('subscriptions.description')">
      <template #actions>
        <Button variant="primary" @click="dialogOpen = true"><Plus /> {{ t('subscriptions.followIndustry') }}</Button>
      </template>
    </PageHeader>
    <Card>
      <CardHeader :title="t('app.subscriptions')">
        <template #icon><Bell /></template>
      </CardHeader>
      <div class="w-full overflow-x-auto">
        <table class="w-full text-sm [&_td:first-child]:ps-5 [&_td:last-child]:pe-5 [&_th:first-child]:ps-5 [&_th:last-child]:pe-5">
          <thead>
            <tr>
              <TH>{{ t('subscriptions.mail') }}</TH>
              <TH>{{ t('schema.industry') }}</TH>
              <TH>{{ t('subscriptions.event') }}</TH>
              <TH>{{ t('subscriptions.triggers') }}</TH>
              <TH>{{ t('subscriptions.lastMail') }}</TH>
              <TH class="w-12" />
            </tr>
          </thead>
          <SettingsTableState :loading="loading" :empty="!subscriptions.length" :columns="6" :title="t('subscriptions.empty')">
            <template #icon><BellOff /></template>
          </SettingsTableState>
          <tbody v-if="!loading && subscriptions.length">
            <tr v-for="s in subscriptions" :key="s.id" class="transition-colors hover:bg-muted/40 [&:last-child>td]:border-0">
              <td class="border-b border-border/70 px-3 py-2.5" dir="ltr">{{ s.email }}</td>
              <td class="border-b border-border/70 px-3 py-2.5" dir="auto">{{ s.industry ? industryName(s.industry) : '—' }}</td>
              <td class="border-b border-border/70 px-3 py-2.5"><code v-if="s.event_id" class="mono text-xs" dir="ltr">{{ s.event_id }}</code><template v-else>—</template></td>
              <td class="border-b border-border/70 px-3 py-2.5">
                <div class="flex flex-wrap gap-1">
                  <Badge v-for="x in s.triggers" :key="x" tone="primary">{{ t(`subscriptions.trigger.${x}`) }}</Badge>
                </div>
              </td>
              <td class="border-b border-border/70 px-3 py-2.5 tabular-nums text-muted-foreground" dir="ltr">{{ formatDateTime(s.last_notified_at) }}</td>
              <td class="border-b border-border/70 px-3 py-2.5 text-end">
                <Button variant="ghost" size="icon-sm" class="text-danger hover:bg-danger-soft" :aria-label="t('subscriptions.stop')" :title="t('subscriptions.stop')" @click="remove(s)"><BellOff /></Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
    <SubscribeDialog v-model:open="dialogOpen" @subscribed="reload" />
  </div>
</template>
