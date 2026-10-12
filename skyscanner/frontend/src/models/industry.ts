/**
 * The payloads of the industries, rendered as the filter tabs above the inventory table and as the industries page.
 */

interface Industry {
  id: string
  key: string
  name: string
  /** What the industry is called on a Hebrew page, empty when it was not given a Hebrew name. */
  name_he: string
  description: string
  /** The Material Design icon the industry is drawn with. */
  icon: string
  /** A colour token written before industries had icons. Stored and handed back, never shown. */
  color: string
  /** The modules an entity of this industry may name. Empty means any text is accepted. */
  modules: string[]
  event_count: number
  created_at: string
}

interface IndustryCreateRequest {
  key: string
  name: string
  name_he: string
  description: string
  icon: string
  modules: string[]
}

interface IndustryUpdateRequest {
  name?: string
  name_he?: string
  description?: string
  icon?: string
  modules?: string[]
}

export type { Industry, IndustryCreateRequest, IndustryUpdateRequest }
