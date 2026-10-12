/**
 * The payloads of the declared platforms, which are the values the platform field of an event may take.
 */

interface Platform {
  id: string
  key: string
  name: string
  /** What the platform is called on a Hebrew page, empty when it was not given a Hebrew name. */
  name_he: string
  description: string
  /** The industries the platform belongs to. An empty list means every industry may name it. */
  industries: string[]
}

interface PlatformDraft {
  key: string
  name: string
  name_he: string
  description: string
  industries: string[]
  order: number
}

export type { Platform, PlatformDraft }
