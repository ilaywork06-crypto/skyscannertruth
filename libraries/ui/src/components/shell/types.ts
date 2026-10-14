import type { Component } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

export interface NavItem {
  to: RouteLocationRaw
  label: string
  icon: Component
  badge?: number | null
  /** Matches when the current path starts with this (defaults to the item's own path). */
  match?: string
  exact?: boolean
}

export interface NavSection {
  label?: string
  items: NavItem[]
}
