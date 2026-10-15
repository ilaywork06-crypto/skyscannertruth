/** The inventory's search term, handed down to whatever paints values (for highlighting) without prop drilling. */
import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'

const KEY: InjectionKey<Ref<string> | ComputedRef<string>> = Symbol('search-term')

export function provideSearchTerm(term: Ref<string> | ComputedRef<string>): void {
  provide(KEY, term)
}

export function useSearchTerm(): ComputedRef<string> {
  const term = inject(KEY, null)
  return computed(() => term?.value ?? '')
}
