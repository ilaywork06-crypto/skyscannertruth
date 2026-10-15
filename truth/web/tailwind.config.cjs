/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@truth-platform/ui/tailwind-preset')],
  content: ['./index.html', './src/**/*.{vue,ts}', '../../libraries/ui/src/**/*.{vue,ts}', '../../libraries/grid/src/**/*.{vue,ts}'],
}
