/**
 * The Tailwind preset both clients build with - the Lattice design language.
 *
 * Every colour is a custom property holding rgb channels (see src/theme/palette.ts), so light/dark and the
 * colour theme are pure CSS, and the output stays readable by Chrome 90: no oklch(), no color-mix().
 */
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', '"Heebo Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', '"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      colors: {
        background: c('background'),
        foreground: c('foreground'),
        card: { DEFAULT: c('card'), foreground: c('card-foreground') },
        popover: c('popover'),
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        subtle: c('subtle'),
        border: c('border'),
        input: c('input'),
        sidebar: c('sidebar'),
        ring: 'rgb(var(--ring) / var(--ring-alpha))',
        primary: {
          DEFAULT: c('primary'),
          foreground: c('primary-foreground'),
          soft: c('primary-soft'),
          'soft-foreground': c('primary-soft-foreground'),
        },
        success: { DEFAULT: c('success'), soft: c('success-soft') },
        warning: { DEFAULT: c('warning'), soft: c('warning-soft'), foreground: c('warning-foreground') },
        danger: { DEFAULT: c('danger'), soft: c('danger-soft') },
        info: { DEFAULT: c('info'), soft: c('info-soft') },
        chart: { ready: c('chart-ready'), assembled: c('chart-assembled') },
      },
      borderColor: { DEFAULT: c('border') },
      borderRadius: { sm: '6px', md: '9px', lg: '12px', xl: '16px', '2xl': '20px' },
      boxShadow: {
        soft: '0 1px 2px hsl(var(--shadow-color) / 0.05), 0 1px 3px hsl(var(--shadow-color) / 0.06)',
        pop: '0 10px 30px -10px hsl(var(--shadow-color) / 0.3), 0 4px 10px -4px hsl(var(--shadow-color) / 0.12)',
      },
      keyframes: {
        enter: { from: { opacity: '0', transform: 'translateY(4px) scale(0.985)' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        in: 'enter 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        fade: 'fade 200ms ease-out',
      },
    },
  },
  plugins: [],
}
