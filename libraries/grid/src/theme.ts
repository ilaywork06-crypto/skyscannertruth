/**
 * The grid in the Lattice look, built from the live colour tokens.
 *
 * The values handed to AG Grid are concrete hex colours read off the page (not `var()` references): the grid
 * derives hovers and borders from them with `color-mix()`, and on an old browser the compatibility shim can
 * only work those out from colours it can read.
 */
import { themeQuartz } from 'ag-grid-community'

function token(name: string, alpha = 1): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
  const [r, g, b] = raw.split(/\s+/).map(Number)
  if (![r, g, b].every(Number.isFinite)) return '#8c9ac4'
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}${alpha < 1 ? hex(alpha * 255) : ''}`
}

export function buildGridTheme(isDark: boolean) {
  return themeQuartz.withParams({
    accentColor: token('primary'),
    backgroundColor: token('card'),
    foregroundColor: token('foreground'),
    textColor: token('foreground'),
    borderColor: token('border'),
    browserColorScheme: isDark ? 'dark' : 'light',
    chromeBackgroundColor: token('card'),
    headerBackgroundColor: token('muted'),
    headerTextColor: token('muted-foreground'),
    headerFontWeight: 500,
    headerFontSize: 12,
    oddRowBackgroundColor: token('card'),
    rowHoverColor: token('muted'),
    selectedRowBackgroundColor: token('primary-soft'),
    rowBorder: { style: 'solid', width: 1, color: token('border') },
    columnBorder: false,
    headerColumnBorder: false,
    wrapperBorder: false,
    wrapperBorderRadius: 0,
    cellHorizontalPadding: 12,
    fontFamily: 'inherit',
    fontSize: 13.5,
    spacing: 7,
    iconSize: 15,
    checkboxCheckedBackgroundColor: token('primary'),
    checkboxBorderRadius: 5,
    inputFocusBorder: { color: token('primary') },
    menuBackgroundColor: token('popover'),
    menuBorder: { color: token('border') },
    popupShadow: '0 10px 30px -10px rgba(0,0,0,0.3)',
    tooltipBackgroundColor: token('foreground'),
    tooltipTextColor: token('background'),
  })
}
