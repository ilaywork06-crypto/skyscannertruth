/**
 * Vuetify: themes, icons, locales and component defaults.
 */

import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import { en, he } from 'vuetify/locale'

import { DARK, LIGHT, darkTheme, lightTheme } from './theme'

const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } },
  locale: { locale: 'en', fallback: 'en', messages: { en, he }, rtl: { en: false, he: true } },
  theme: {
    defaultTheme: DARK,
    themes: { [DARK]: darkTheme, [LIGHT]: lightTheme },
  },
  defaults: {
    global: { ripple: false },
    VBtn: { rounded: 'lg', variant: 'flat', class: 'text-none', style: 'letter-spacing: 0' },
    VCard: { rounded: 'xl', flat: true },
    VChip: { size: 'small', rounded: 'md' },
    VTextField: { variant: 'outlined', density: 'comfortable', rounded: 'lg', hideDetails: 'auto', color: 'primary' },
    VTextarea: { variant: 'outlined', rounded: 'lg', hideDetails: 'auto', color: 'primary' },
    VSelect: { variant: 'outlined', density: 'comfortable', rounded: 'lg', hideDetails: 'auto', color: 'primary' },
    VAutocomplete: { variant: 'outlined', density: 'comfortable', rounded: 'lg', hideDetails: 'auto', color: 'primary' },
    VCombobox: { variant: 'outlined', density: 'comfortable', rounded: 'lg', hideDetails: 'auto', color: 'primary' },
    VCheckbox: { density: 'compact', hideDetails: true, color: 'primary' },
    VSwitch: { density: 'compact', hideDetails: true, color: 'primary', inset: true },
    VMenu: { transition: 'scale-transition' },
    VTooltip: { location: 'top', openDelay: 400 },
    VDialog: { scrim: 'rgba(5, 8, 20, 0.6)' },
  },
})

export { DARK, LIGHT }
export default vuetify
