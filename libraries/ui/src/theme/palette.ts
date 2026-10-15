/**
 * The colour themes, worked out to plain RGB.
 *
 * The palettes are designed in OKLCH - one hue per theme, every surface and accent derived from it - but the
 * clients are opened on browsers as old as Chrome 90, which reads neither `oklch()` nor `color-mix()`. So the
 * formulas run here, once, and the page only ever sees `rgb()` channels in custom properties
 * (`--primary: 79 70 229`), which Tailwind turns into `rgb(var(--primary) / <alpha>)`.
 */

export type Mode = 'light' | 'dark'

export const ACCENTS = ['indigo', 'classic', 'periwinkle', 'lavender', 'blush', 'peach', 'butter', 'mint', 'sky'] as const
export type Accent = (typeof ACCENTS)[number]
export const DEFAULT_ACCENT: Accent = 'indigo'

/** One colour as L, C, h (OKLCH) with an optional alpha. */
type Lch = readonly [l: number, c: number, h: number, alpha?: number]

/** Every token a theme defines. Colours are OKLCH triples; `barOpacity` is a plain number. */
export interface Tokens {
  background: Lch
  foreground: Lch
  card: Lch
  popover: Lch
  muted: Lch
  mutedForeground: Lch
  subtle: Lch
  border: Lch
  input: Lch
  sidebar: Lch
  primary: Lch
  primaryForeground: Lch
  primarySoft: Lch
  primarySoftForeground: Lch
  ring: Lch
  success: Lch
  successSoft: Lch
  warning: Lch
  warningSoft: Lch
  warningForeground: Lch
  danger: Lch
  dangerSoft: Lch
  info: Lch
  infoSoft: Lch
  chartAssembled: Lch
  /** Mixed from `success` and `card` (82%) unless the theme says otherwise. */
  chartReady?: Lch
  barOpacity: number
  shadow: string
}

// ─────────────────────────── OKLCH → sRGB ───────────────────────────

function toSrgb([l, c, h]: Lch): [number, number, number] {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  return linear.map((v) => {
    const g = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.abs(v) ** (1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, g)) * 255)
  }) as [number, number, number]
}

const channels = (c: Lch) => toSrgb(c).join(' ')

/** sRGB mix, as `color-mix(in srgb, a p%, b)` would compute it. */
function mix(a: Lch, b: Lch, p: number): string {
  const x = toSrgb(a)
  const y = toSrgb(b)
  return x.map((v, i) => Math.round(v * p + y[i] * (1 - p))).join(' ')
}

/** A colour for an inline style (avatars, swatches, canvases). */
export function rgb(c: Lch, alpha = 1): string {
  const [r, g, b] = toSrgb(c)
  return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ─────────────────────────── The palettes ───────────────────────────

/** A pastel theme: one hue, and how coloured its surfaces and primary are. */
interface Hue {
  hue: number
  tint?: number
  primaryL?: number
  primaryC?: number
}

const PASTELS: Record<Exclude<Accent, 'indigo' | 'classic'>, Hue> = {
  periwinkle: { hue: 268 },
  lavender: { hue: 302 },
  blush: { hue: 355, primaryL: 0.6, primaryC: 0.14 },
  peach: { hue: 45, primaryL: 0.62, primaryC: 0.13 },
  butter: { hue: 88, primaryL: 0.6, primaryC: 0.115, tint: 1.3 },
  mint: { hue: 168, primaryL: 0.58, primaryC: 0.1 },
  sky: { hue: 232, primaryL: 0.58, primaryC: 0.12 },
}

function pastel({ hue: h, tint: t = 1, primaryL = 0.57, primaryC = 0.13 }: Hue, mode: Mode): Tokens {
  if (mode === 'light') {
    return {
      background: [0.978, 0.011 * t, h],
      foreground: [0.24, 0.025 * t, h],
      card: [0.997, 0.003 * t, h],
      popover: [0.997, 0.003 * t, h],
      muted: [0.958, 0.016 * t, h],
      mutedForeground: [0.51, 0.028 * t, h],
      subtle: [0.935, 0.024 * t, h],
      border: [0.915, 0.02 * t, h],
      input: [0.885, 0.026 * t, h],
      sidebar: [0.958, 0.022 * t, h],
      primary: [primaryL, primaryC, h],
      primaryForeground: [0.995, 0.005, h],
      primarySoft: [0.925, 0.05, h],
      primarySoftForeground: [0.42, primaryC * 0.85, h],
      ring: [0.72, 0.11, h, 0.5],
      success: [0.6, 0.13, 158],
      successSoft: [0.94, 0.05, 158],
      warning: [0.72, 0.14, 70],
      warningSoft: [0.95, 0.06, 85],
      warningForeground: [0.5, 0.12, 65],
      danger: [0.6, 0.18, 22],
      dangerSoft: [0.94, 0.04, 18],
      info: [0.62, 0.12, 235],
      infoSoft: [0.94, 0.04, 235],
      chartAssembled: [0.72, 0.11, 300],
      barOpacity: 0.8,
      shadow: '250 25% 25%',
    }
  }
  return {
    background: [0.17, 0.016 * t, h],
    foreground: [0.95, 0.01 * t, h],
    card: [0.205, 0.018 * t, h],
    popover: [0.225, 0.02 * t, h],
    muted: [0.24, 0.02 * t, h],
    mutedForeground: [0.72, 0.03 * t, h],
    subtle: [0.275, 0.022 * t, h],
    border: [0.3, 0.022 * t, h],
    input: [0.35, 0.026 * t, h],
    sidebar: [0.185, 0.018 * t, h],
    primary: [0.8, primaryC * 0.75, h],
    primaryForeground: [0.2, 0.04, h],
    primarySoft: [0.31, 0.06, h],
    primarySoftForeground: [0.88, 0.07, h],
    ring: [0.8, 0.09, h, 0.45],
    success: [0.78, 0.12, 158],
    successSoft: [0.31, 0.05, 158],
    warning: [0.83, 0.12, 80],
    warningSoft: [0.33, 0.05, 75],
    warningForeground: [0.83, 0.12, 80],
    danger: [0.74, 0.14, 20],
    dangerSoft: [0.31, 0.06, 20],
    info: [0.78, 0.1, 235],
    infoSoft: [0.31, 0.05, 235],
    chartAssembled: [0.72, 0.11, 300],
    barOpacity: 0.8,
    shadow: '250 40% 2%',
  }
}

/** Indigo: near-white neutral surfaces with a vivid indigo primary - the Lattice default. */
function indigo(mode: Mode): Tokens {
  if (mode === 'light') {
    return {
      background: [0.985, 0.002, 260],
      foreground: [0.21, 0.02, 265],
      card: [1, 0, 0],
      popover: [1, 0, 0],
      muted: [0.965, 0.004, 260],
      mutedForeground: [0.52, 0.02, 262],
      subtle: [0.94, 0.006, 260],
      border: [0.915, 0.006, 260],
      input: [0.89, 0.008, 260],
      sidebar: [0.975, 0.003, 260],
      primary: [0.52, 0.21, 275],
      primaryForeground: [0.99, 0, 0],
      primarySoft: [0.95, 0.035, 275],
      primarySoftForeground: [0.42, 0.19, 275],
      ring: [0.62, 0.17, 275, 0.45],
      success: [0.6, 0.15, 155],
      successSoft: [0.95, 0.045, 155],
      warning: [0.72, 0.16, 70],
      warningSoft: [0.96, 0.06, 85],
      warningForeground: [0.5, 0.12, 65],
      danger: [0.58, 0.22, 25],
      dangerSoft: [0.95, 0.035, 25],
      info: [0.6, 0.15, 240],
      infoSoft: [0.95, 0.035, 240],
      chartAssembled: [0.6, 0.17, 300],
      chartReady: [0.6, 0.15, 155],
      barOpacity: 1,
      shadow: '230 20% 20%',
    }
  }
  return {
    background: [0.16, 0.012, 265],
    foreground: [0.95, 0.005, 260],
    card: [0.2, 0.014, 265],
    popover: [0.22, 0.015, 265],
    muted: [0.235, 0.014, 265],
    mutedForeground: [0.7, 0.015, 262],
    subtle: [0.27, 0.016, 265],
    border: [0.29, 0.016, 265],
    input: [0.34, 0.018, 265],
    sidebar: [0.18, 0.013, 265],
    primary: [0.66, 0.18, 275],
    primaryForeground: [0.16, 0.02, 275],
    primarySoft: [0.3, 0.07, 275],
    primarySoftForeground: [0.85, 0.09, 275],
    ring: [0.66, 0.17, 275, 0.5],
    success: [0.72, 0.15, 155],
    successSoft: [0.3, 0.06, 155],
    warning: [0.8, 0.14, 75],
    warningSoft: [0.32, 0.06, 75],
    warningForeground: [0.8, 0.14, 75],
    danger: [0.68, 0.19, 25],
    dangerSoft: [0.3, 0.07, 25],
    info: [0.72, 0.13, 240],
    infoSoft: [0.3, 0.06, 240],
    chartAssembled: [0.6, 0.17, 300],
    chartReady: [0.72, 0.15, 155],
    barOpacity: 1,
    shadow: '230 40% 2%',
  }
}

/** Classic: untinted white and grey, a black primary in light and a white one in dark. */
function classic(mode: Mode): Tokens {
  const base = pastel({ hue: 268, tint: 0, primaryL: 0.22, primaryC: 0 }, mode)
  return mode === 'light'
    ? { ...base, primarySoft: [0.94, 0, 0], primarySoftForeground: [0.28, 0, 0], ring: [0.55, 0, 0, 0.4] }
    : {
        ...base,
        primary: [0.96, 0, 0],
        primaryForeground: [0.17, 0, 0],
        primarySoft: [0.3, 0, 0],
        primarySoftForeground: [0.92, 0, 0],
        ring: [0.8, 0, 0, 0.4],
      }
}

export function tokens(accent: Accent, mode: Mode): Tokens {
  if (accent === 'indigo') return indigo(mode)
  if (accent === 'classic') return classic(mode)
  return pastel(PASTELS[accent], mode)
}

const KEBAB: Record<string, string> = {
  mutedForeground: 'muted-foreground',
  primaryForeground: 'primary-foreground',
  primarySoft: 'primary-soft',
  primarySoftForeground: 'primary-soft-foreground',
  successSoft: 'success-soft',
  warningSoft: 'warning-soft',
  warningForeground: 'warning-foreground',
  dangerSoft: 'danger-soft',
  infoSoft: 'info-soft',
  chartAssembled: 'chart-assembled',
}

/** The custom properties of one theme, as a `--name: value;` block. */
export function themeCss(accent: Accent, mode: Mode): string {
  const t = tokens(accent, mode)
  const out: string[] = []
  for (const [key, value] of Object.entries(t)) {
    if (key === 'barOpacity' || key === 'shadow' || key === 'chartReady') continue
    const c = value as Lch
    out.push(`--${KEBAB[key] ?? key}: ${channels(c)}`)
    if (c[3] !== undefined) out.push(`--${KEBAB[key] ?? key}-alpha: ${c[3]}`)
  }
  out.push(`--card-foreground: ${channels(t.foreground)}`)
  out.push(`--chart-ready: ${t.chartReady ? channels(t.chartReady) : mix(t.success, t.card, 0.82)}`)
  out.push(`--bar-opacity: ${t.barOpacity}`)
  out.push(`--shadow-color: ${t.shadow}`)
  out.push(`color-scheme: ${mode}`)
  return out.join('; ')
}

/** What the colour picker paints for a theme: its pastel and its primary. */
export function swatch(accent: Accent): { soft: string; strong: string } {
  const light = tokens(accent, 'light')
  const soft = accent === 'indigo' ? rgb([0.97, 0.004, 260]) : accent === 'classic' ? rgb([0.97, 0, 0]) : rgb([0.87, 0.07, (PASTELS as Record<string, Hue>)[accent].hue])
  return { soft, strong: rgb(light.primary) }
}
