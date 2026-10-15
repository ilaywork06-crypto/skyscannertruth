<script setup lang="ts">
/**
 * The app's one confirmation dialog (fed by the library's `useConfirm`/`useDirtyGuard`), drawn above every other
 * dialog. The library's ConfirmHost shares the z-index of the dialog that asks, so when that dialog opened after
 * it, the dialog's overlay covered the question; this layer always sits on top.
 */
import { AlertTriangle } from 'lucide-vue-next'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { Button, pendingConfirm, settleConfirm, translate as t, usePreferences } from '@truth-platform/ui'
import { computed } from 'vue'

const { direction } = usePreferences()
const open = computed({
  get: () => !!pendingConfirm.value,
  set: (v: boolean) => !v && settleConfirm(false),
})
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[80] animate-fade bg-black/40 backdrop-blur-[2px]" />
      <DialogContent
        :dir="direction"
        class="fixed left-1/2 top-1/2 z-[80] flex w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 animate-in flex-col rounded-2xl border border-border bg-popover shadow-pop outline-none"
      >
        <div class="flex items-start gap-3 px-6 pb-4 pt-5">
          <div v-if="pendingConfirm?.danger" class="grid size-9 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger [&_svg]:size-[18px]">
            <AlertTriangle />
          </div>
          <div class="min-w-0 flex-1">
            <DialogTitle class="text-base font-semibold tracking-tight">{{ pendingConfirm?.title }}</DialogTitle>
            <DialogDescription class="mt-1 text-[13px] text-muted-foreground">{{ pendingConfirm?.description }}</DialogDescription>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-border bg-muted/40 px-6 py-3">
          <Button variant="ghost" @click="settleConfirm(false)">{{ pendingConfirm?.cancelLabel ?? t('common.cancel') }}</Button>
          <Button :variant="pendingConfirm?.danger ? 'danger' : 'primary'" autofocus @click="settleConfirm(true)">
            {{ pendingConfirm?.confirmLabel ?? t('common.confirm') }}
          </Button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
