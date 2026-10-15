/**
 * Ordering by drag: after a drop every row of the list is given `order = (position + 1) * 10` and the rows
 * are patched (`PATCH … {order}`); the service sorts selectors, columns and lists by it.
 */
import { notify, reportError, translate as t } from '@truth-platform/ui'
import { ref } from 'vue'

export function useSettingsOrder<T extends { id: string }>(patch: (id: string, order: number) => Promise<unknown>, after?: () => unknown) {
  const saving = ref(false)
  async function persist(rows: T[]) {
    saving.value = true
    try {
      await Promise.all(rows.map((row, i) => patch(row.id, (i + 1) * 10)))
      notify(t('settings.orderSaved'), 'success')
    } catch (error) {
      reportError(error)
    } finally {
      saving.value = false
      await after?.()
    }
  }
  return { saving, persist }
}
