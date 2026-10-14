<script setup lang="ts">
import { AlertTriangle } from 'lucide-vue-next'
import { computed } from 'vue'
import { pendingConfirm, settleConfirm } from '../../composables/confirm'
import { translate as t } from '../../i18n'
import Button from './Button.vue'
import Dialog from './Dialog.vue'

const open = computed({
  get: () => !!pendingConfirm.value,
  set: (v: boolean) => !v && settleConfirm(false),
})
</script>

<template>
  <Dialog v-model:open="open" size="sm" :title="pendingConfirm?.title" :description="pendingConfirm?.description">
    <template v-if="pendingConfirm?.danger" #icon><AlertTriangle /></template>
    <template #footer>
      <Button variant="ghost" @click="settleConfirm(false)">{{ pendingConfirm?.cancelLabel ?? t('common.cancel') }}</Button>
      <Button :variant="pendingConfirm?.danger ? 'danger' : 'primary'" autofocus @click="settleConfirm(true)">
        {{ pendingConfirm?.confirmLabel ?? t('common.confirm') }}
      </Button>
    </template>
  </Dialog>
</template>
