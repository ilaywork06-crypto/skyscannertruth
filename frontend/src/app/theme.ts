/**
 * The design tokens - the only place colours are defined. Components read them as
 * `rgb(var(--v-theme-<token>))` or through Vuetify's `color` props.
 */

import type { ThemeDefinition } from 'vuetify'

const DARK = 'truthDark'
const LIGHT = 'truthLight'

/** Eight distinct, balanced hues for hashed chips (tags, schemas, industries). */
const darkChips = {
  'chip-1': '#6E9BFF',
  'chip-2': '#A78BFA',
  'chip-3': '#2DD4BF',
  'chip-4': '#FBBF24',
  'chip-5': '#F472B6',
  'chip-6': '#4ADE80',
  'chip-7': '#FB923C',
  'chip-8': '#38BDF8',
}

const lightChips = {
  'chip-1': '#2F5BEA',
  'chip-2': '#7C3AED',
  'chip-3': '#0F9488',
  'chip-4': '#B7791F',
  'chip-5': '#DB2777',
  'chip-6': '#15803D',
  'chip-7': '#C2410C',
  'chip-8': '#0369A1',
}

const darkTheme: ThemeDefinition = {
  dark: true,
  colors: {
    background: '#0A0E1C',
    'on-background': '#E7EAF6',
    surface: '#11162A',
    'on-surface': '#E7EAF6',
    'surface-bright': '#171D36',
    'surface-light': '#1C2340',
    'surface-variant': '#232B4D',
    'on-surface-variant': '#C9CFE6',
    primary: '#6E8BFF',
    'on-primary': '#FFFFFF',
    secondary: '#A78BFA',
    accent: '#22D3EE',
    info: '#38BDF8',
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    muted: '#8D94B4',
    border: '#252C4A',
    'border-strong': '#343D63',
    sidebar: '#0D1224',
    'row-hover': '#161C35',
    'row-selected': '#1A2244',
    'header-row': '#141A31',
    ...darkChips,
  },
  variables: {
    'border-color': '#C9CFE6',
    'border-opacity': 0.1,
    'hover-opacity': 0.06,
  },
}

const lightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#F5F6FB',
    'on-background': '#141A33',
    surface: '#FFFFFF',
    'on-surface': '#141A33',
    'surface-bright': '#FFFFFF',
    'surface-light': '#F0F2F9',
    'surface-variant': '#E6E9F4',
    'on-surface-variant': '#3B4366',
    primary: '#3D5AFE',
    'on-primary': '#FFFFFF',
    secondary: '#7C3AED',
    accent: '#0891B2',
    info: '#0284C7',
    success: '#059669',
    warning: '#B45309',
    error: '#DC2626',
    muted: '#646C8F',
    border: '#E3E6F0',
    'border-strong': '#CDD2E3',
    sidebar: '#FFFFFF',
    'row-hover': '#F5F7FD',
    'row-selected': '#EEF1FE',
    'header-row': '#F8F9FD',
    ...lightChips,
  },
  variables: {
    'border-color': '#141A33',
    'border-opacity': 0.1,
    'hover-opacity': 0.04,
  },
}

export { DARK, LIGHT, darkTheme, lightTheme }
