/**
 * Keeping the table's view and the address in step, both ways: an address (reload, shared link, back
 * button) is shown, and whatever the reader changes is written back - replacing the history entry rather
 * than adding one per keystroke.
 */

import { onScopeDispose, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { foreignParams, readView, sameQuery, writeView, type AddressQuery } from '@/domain/register/view-url'

import type { RegisterTable } from './useRegisterTable'

/** Typing a search changes the view on every letter; this keeps the history API calm. */
const WRITE_DELAY_MS = 250

const useViewInAddress = (table: RegisterTable, onWritten?: (fullPath: string) => void) => {
  const route = useRoute()
  const router = useRouter()
  let timer: ReturnType<typeof setTimeout> | null = null

  const written = () => writeView(table.view.value, table.viewDefaults)
  const inStep = () => sameQuery(written(), writeView(readView(route.query as AddressQuery, table.viewDefaults), table.viewDefaults))

  const adopt = () => table.applyView(readView(route.query as AddressQuery, table.viewDefaults))

  const write = async () => {
    timer = null
    if (!inStep()) {
      await router.replace({ query: { ...foreignParams(route.query as AddressQuery), ...written() } })
    }
    onWritten?.(route.fullPath)
  }

  adopt()

  watch(
    () => JSON.stringify(written()),
    () => {
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(() => void write(), WRITE_DELAY_MS)
    },
  )

  /* An address that moves under the same page (back button, a link to another view) is shown. */
  watch(
    () => route.query,
    () => {
      if (!inStep()) adopt()
    },
  )

  onWritten?.(route.fullPath)

  onScopeDispose(() => {
    if (timer !== null) clearTimeout(timer)
  })
}

export { useViewInAddress }
