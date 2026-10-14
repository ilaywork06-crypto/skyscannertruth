/**
 * Text in two languages at once. A value never takes its direction from the page: it is laid out by its
 * own first strong letter, and a value written into a sentence is fenced off so it cannot drag the
 * punctuation around it to the wrong side.
 */
export const ISOLATE_START = '⁨' // FSI
export const ISOLATE_END = '⁩' // PDI

export function isolate(text: string): string {
  return text === '' ? '' : ISOLATE_START + text + ISOLATE_END
}

export function joinIsolated(pieces: string[], separator = ', '): string {
  return pieces.filter((p) => p !== '').map(isolate).join(separator)
}

const STRONG_LETTER = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ֐-׿؀-ۿ]/

/**
 * `'auto'` for a value holding a letter, so it stands on the side its own language starts from; nothing
 * for a number, a date or a dash, which then follow their column instead of being forced left to right.
 */
export function valueDirection(text: string | null | undefined): 'auto' | undefined {
  return text && STRONG_LETTER.test(text) ? 'auto' : undefined
}
