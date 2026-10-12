<template>
  <v-app>
    <v-main class="app-shell">
      <RouterView />
      <AppSnackbar />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { AppSnackbar, useSnackbar } from '@truth-platform/core-ui'
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import { useRegister } from '@/composables/useRegister'

const { load } = useRegister()
const { reportError } = useSnackbar()

/*
 * The whole register is read once, here, rather than by each page that needs a piece of it: the API offers no
 * way to ask a narrower question, so every page would otherwise read the same collections over again.
 */
onMounted(async () => {
  try {
    await load()
  } catch (error) {
    reportError(error)
  }
})
</script>

<style>
/*
 * The two families of the design. Inter is the interface type and carries everything the user reads inside
 * the application: controls, labels, headings and table cells alike. Kufam is the display type, and in the
 * mockups it appears in one single place - the wordmark - so it is scoped to exactly that.
 */
:root {
  --truth-font-body: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
  --truth-font-display: 'Kufam', 'Inter', 'Segoe UI', system-ui, sans-serif;
}

html,
body,
#app {
  block-size: 100%;
}

/*
 * Vuetify names its own family on the application root and on several of its components, so the interface
 * type has to be restated at least as specifically to win. Menus and dialogs are teleported out of the
 * application root into the overlay container, which is why that is listed as well.
 */
.v-application,
.v-application .v-btn,
.v-application .v-field__input,
.v-application .v-list-item-title,
.v-overlay-container,
.v-overlay-container .v-btn,
.v-overlay-container .v-list-item-title {
  font-family: var(--truth-font-body);
}

/*
 * The words of the interface stand on the side the language they are written in starts from.
 *
 * A line of Hebrew left to a left to right box is not merely aligned to the wrong edge: the full stop that
 * ends it is drawn at the far left, a bracket opens on the side it should close on, and a sentence that
 * wraps breaks the wrong way round. So every element that holds a phrase of the interface - a heading, a
 * paragraph, a label, the title of a card, the message under a field - is turned around on a Hebrew page.
 * Each of them holds words and nothing else, so turning one moves no control and mirrors no layout.
 *
 * Only the interface's own words are turned. Anything holding the register's own data says so with a `dir`
 * of its own - `auto` on a value, `ltr` on a key or a date - and is left out here, because a value reads the
 * way it was written whatever language the page around it is in.
 *
 * This lives here rather than in the shared library because the inventory beside this client keeps its
 * pages exactly as they are in both languages, and nothing about that is this client's to change.
 */
html[lang='he']
  :where(
    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    p,
    li,
    dt,
    dd,
    label,
    legend,
    figcaption,
    .v-card-title,
    .v-card-subtitle,
    .v-alert__content,
    .v-messages__message
  ):not([dir]) {
  direction: rtl;
}

/*
 * What a menu offers is usually somebody's own name for something, so each line stands on the side of its
 * own language rather than on the side the menu runs: an English name on the left of a Hebrew menu, a Hebrew
 * name on the right of an English one. `plaintext` is what makes `start` mean the beginning of the line's
 * own language rather than the beginning of the menu's.
 */
.v-list-item-title,
.v-chip__content {
  unicode-bidi: plaintext;
  text-align: start;
}

/*
 * A date is read left to right in both languages: the browser lays its parts out in the order of its own
 * locale, and inside a table that runs the other way "22/09/2026, 21:36" was handed back with the clock
 * first and the comma at the wrong end of it.
 */
html[lang='he'] .date-cell {
  direction: ltr;
}

/*
 * A dialog and a menu are read the way the interface is written, whole.
 *
 * The page keeps its arrangement in both languages - the header, the toolbar, the tabs and every icon stay
 * where they are, and only a table turns around - but a dialog is a piece of writing rather than a piece of
 * the page: it asks something, in one language, and reading it means reading its title, its fields and its
 * buttons in the same direction. Half of one turned around reads worse than either whole one.
 *
 * Everything a dialog or a menu is made of is teleported into the overlay container, which is what makes
 * this exactly them and nothing else on the page behind them.
 */
html[lang='he'] .v-overlay-container :where(.v-card, .v-list, .v-sheet) {
  direction: rtl;
}

/*
 * A box to tick and what it is called are one line, and they turn with the dialog around them.
 *
 * Vuetify decides the direction of its own inputs from its locale, and neither language mirrors Vuetify -
 * that is what keeps the page's own arrangement the same in both. So a tick box inside a turned around
 * dialog has to be told, or it alone stays the other way round with its label reading away from it.
 */
html[lang='he'] .v-overlay-container :where(.v-checkbox, .v-switch, .v-radio-group, .v-selection-control-group) {
  direction: rtl;
}

.app-shell {
  min-block-size: 100vh;
  background-color: rgb(var(--v-theme-background));
}

/* Every page grows with its content and lets the browser scroll it, rather than pinning to the viewport. */
.sky-page {
  display: flex;
  flex-direction: column;
  min-block-size: 100vh;
}

.sky-page__content {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 1rem;
  padding-inline: 2rem;
  padding-block: 1rem;
  min-inline-size: 0;
}

/*
 * A cell of the table has to keep what it holds inside its own column. The grid only clips the cells whose
 * height is fixed, so a cell that grows to fit its content would otherwise let a long value run straight
 * across the columns beside it.
 *
 * The rows are as tall as their content needs, so a cell sits at the top of its own rather than in the
 * middle of it: a three line assumption beside a single chip should start level with that chip, the way the
 * design lays a tall row out. The room above a value and the height of a line are the ones that make a row of
 * single values exactly as tall as the table's own row height, with a line of text and a chip on one centre.
 */
.sky-cell {
  display: flex;
  align-items: flex-start;
  min-inline-size: 0;
  overflow: hidden;
  /*
   * Which way a value runs is decided by the value rather than by the page. `plaintext` is `dir="auto"` as a
   * rule instead of an attribute: every run inside the cell takes its direction from the first letter in it
   * that has one, so a Hebrew note reads right to left inside an English table, an English identifier reads
   * left to right inside a Hebrew one, and a value that mixes the two keeps each part the way it was typed
   * instead of the whole line being turned around.
   */
  unicode-bidi: plaintext;
  padding-block: 0.625rem;
  line-height: 1.5rem;
}

.sky-cell > * {
  min-inline-size: 0;
  max-inline-size: 100%;
}

/*
 * The header is set the way the other product sets its own: capitals, a little spacing, and the name read the
 * way it was written. Hebrew has no capitals, so the transform changes nothing there.
 */
.sky-header .ag-header-cell-comp-wrapper {
  unicode-bidi: plaintext;
}

.sky-header .ag-header-cell-text {
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

/* A cell that wraps is a paragraph rather than a line, and the row grew for it. */
.ag-cell-wrap-text.sky-cell {
  align-items: flex-start;
  white-space: normal;
  overflow-wrap: anywhere;
}

/* A column of bookkeeping stamps reads at the end of its column rather than at the start of it. */
.sky-cell--stamp {
  justify-content: flex-end;
}

.sky-header--stamp .ag-header-cell-label {
  justify-content: flex-end;
}

/*
 * A chip list wraps inside its own cell rather than running off the side of it, which is what lets a row
 * filed under four industries show all four instead of the first two and a half.
 */
.sky-cell .chip-list {
  flex-wrap: wrap;
}

/*
 * The scrollbars of the page and of everything that scrolls inside it are thin and drawn in the palette,
 * instead of the grey slabs a browser paints by default. Both notations are written: the standard one for a
 * current browser and the prefixed one for the older ones this client is also opened in.
 */
html,
.v-overlay-container {
  scrollbar-color: rgb(var(--v-theme-control-border)) transparent;
}

::-webkit-scrollbar {
  inline-size: 0.625rem;
  block-size: 0.625rem;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  border: 0.125rem solid transparent;
  border-radius: 999rem;
  background-color: rgb(var(--v-theme-control-border));
  background-clip: padding-box;
}

::-webkit-scrollbar-corner {
  background: transparent;
}

@media (max-width: 48rem) {
  .sky-page__content {
    padding-inline: 1rem;
  }
}
</style>
