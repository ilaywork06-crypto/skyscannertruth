/**
 * `const confirm = useConfirm(); if (await confirm({...})) …` - one dialog for the whole app, rendered by
 * <ConfirmHost/> at the root.
 */
import { shallowRef } from 'vue'
import { translate } from '../i18n'

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

export const pendingConfirm = shallowRef<Pending | null>(null)

export function useConfirm() {
  return (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      pendingConfirm.value?.resolve(false)
      pendingConfirm.value = { ...options, resolve }
    })
}

export function settleConfirm(ok: boolean): void {
  const p = pendingConfirm.value
  pendingConfirm.value = null
  p?.resolve(ok)
}

/**
 * Asks before throwing away unsaved changes - the "leave without saving?" question every edit dialog asks.
 */
export function useDirtyGuard(options: { isDirty: () => boolean; close: () => void }) {
  const confirm = useConfirm()
  return {
    async attemptClose(): Promise<void> {
      if (!options.isDirty()) return options.close()
      const discard = await confirm({
        title: translate('common.unsavedTitle'),
        description: translate('common.unsavedBody'),
        confirmLabel: translate('common.discard'),
        cancelLabel: translate('common.keepEditing'),
        danger: true,
      })
      if (discard) options.close()
    },
  }
}
