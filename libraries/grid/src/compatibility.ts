/**
 * AG Grid's stylesheets, made readable by old browsers.
 *
 * The clients are opened on workstations as old as Chrome 90. AG Grid's Theming API injects its CSS at run time,
 * and that CSS uses three things such a browser throws away:
 *
 * - `color-mix()` (Chrome 111): every derived border, hover and header separator is dropped - a table with no
 *   borders and unreadable headers.
 * - nested rules (Chrome 112, and the relaxed form only from 120): ~140 rules such as
 *   `.ag-header-cell-resize { …; &:after { … } }` become parse errors, taking resize handles, checkbox ticks,
 *   sort arrows, hovered rows and focus rings with them.
 * - unprefixed `mask-*` (Chrome 120): every icon of the table is drawn as a solid square.
 *
 * Each is detected on its own and repaired on its own: mixes are worked out to hex (expanding the grid's custom
 * properties first, with the alpha-weighted arithmetic the function is defined by), nested rules are hoisted to
 * stand alone, masks get their `-webkit-` twin. The injected sheets are watched, because the grid writes them
 * again whenever its theme changes. `tests/compatibility.test.mjs` checks the flattening against every
 * stylesheet AG Grid actually ships.
 */

export type Variables = Map<string, string>
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

const INJECTED_STYLES = 'style[data-ag-global-css]'
const PALETTE_STYLES = '[class*="ag-theme-params-"] > style'
const MIX_PATTERN = /color-mix\(\s*in\s+srgb\s*,\s*((?:[^()]|\([^()]*\))*)\)/i
const VARIABLE_PATTERN = /(--[\w-]+)\s*:\s*([^;}]+)/g
const FLAT_RULE = /([^{}]*)\{([^{}]*)\}/g
const THEME_MODE = /\[data-ag-theme-mode=["']?([\w-]+)["']?\]/
const INHERITED_PREFIX = '--ag-inherited-'
const VARIABLE_REFERENCE = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\)[^()]*)*))?\)/
const MAX_VARIABLE_DEPTH = 8
const MAX_PASSES = 16
const NAMED_COLORS: Record<string, string> = { transparent: 'rgba(0, 0, 0, 0)', black: '#000000', white: '#ffffff' }

// ─────────────────────────── detection ───────────────────────────

export function supportsColorMix(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')
}

let nestingSupported: boolean | null = null

/**
 * Whether nested rules are read - asked by parsing one, not by `CSS.supports('selector(&)')`: Chrome 109 answers
 * yes to that and still drops every nested rule. The probe nests a bare element selector, which Chrome 112-119
 * (strict nesting) do not read either.
 */
export function supportsNesting(): boolean {
  if (nestingSupported !== null) return nestingSupported
  if (typeof document === 'undefined') return false
  const scratch = document.implementation.createHTMLDocument('')
  const probe = scratch.createElement('style')
  probe.textContent = '.ag-nesting-probe{b{color:red}}'
  scratch.head.appendChild(probe)
  const rule = probe.sheet?.cssRules[0] as (CSSRule & { cssRules?: CSSRuleList }) | undefined
  nestingSupported = rule?.cssRules !== undefined && rule.cssRules.length === 1
  return nestingSupported
}

export function supportsUnprefixedMask(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('mask-image', 'none')
}

export function needsStyleCompatibility(): boolean {
  return !supportsColorMix() || !supportsNesting() || !supportsUnprefixedMask()
}

// ─────────────────────────── custom properties ───────────────────────────

/** Only rules for a theme mode the page actually shows contribute (the others set the same names to other mixes). */
function appliesToPage(selector: string): boolean {
  const mode = THEME_MODE.exec(selector)
  if (!mode) return true
  return typeof document !== 'undefined' && document.querySelector(`[data-ag-theme-mode="${mode[1]}"]`) !== null
}

export function readVariables(css: string, into: Variables): void {
  for (const rule of flattenNesting(css).matchAll(FLAT_RULE)) {
    if (!appliesToPage(rule[1])) continue
    for (const m of rule[2].matchAll(VARIABLE_PATTERN)) {
      // Handed down to nested tables and written in terms of the readers: following them never reaches a colour.
      if (!m[1].startsWith(INHERITED_PREFIX)) into.set(m[1], m[2].trim())
    }
  }
}

function expandVariables(value: string, variables: Variables, depth = 0): string {
  if (depth >= MAX_VARIABLE_DEPTH) return value
  const m = VARIABLE_REFERENCE.exec(value)
  if (!m) return value
  const replacement = (variables.get(m[1]) ?? m[2] ?? '').trim()
  return expandVariables(value.slice(0, m.index) + replacement + value.slice(m.index + m[0].length), variables, depth + 1)
}

// ─────────────────────────── colours ───────────────────────────

function parseHex(text: string): Rgba | null {
  const digits = text.slice(1)
  const full = digits.length <= 4 ? digits.split('').map((d) => d + d).join('') : digits
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(full)) return null
  const ch = (i: number) => Number.parseInt(full.slice(i, i + 2), 16)
  return { r: ch(0), g: ch(2), b: ch(4), a: full.length > 6 ? ch(6) / 255 : 1 }
}

export function parseColor(value: string): Rgba | null {
  const text = (NAMED_COLORS[value.trim().toLowerCase()] ?? value).trim()
  if (text.startsWith('#')) return parseHex(text)
  const m = /^rgba?\(([^)]+)\)$/i.exec(text)
  if (!m) return null
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  const channel = (p: string) => (p.endsWith('%') ? (Number.parseFloat(p) / 100) * 255 : Number.parseFloat(p))
  const [r, g, b] = parts.slice(0, 3).map(channel)
  if (![r, g, b].every(Number.isFinite)) return null
  // The alpha is a fraction (or a percentage of one), not a channel: `rgba(0,0,0,0.5)` is half transparent.
  const rawAlpha = parts[3]
  const a = rawAlpha === undefined ? 1 : rawAlpha.endsWith('%') ? Number.parseFloat(rawAlpha) / 100 : Number.parseFloat(rawAlpha)
  return { r, g, b, a: Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1 }
}

function splitArguments(body: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of body) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  parts.push(current)
  return parts
}

function readOperand(part: string): { color: string; percent: number | null } {
  const trimmed = part.trim()
  const m = /\s([\d.]+)%$/.exec(trimmed)
  return m ? { color: trimmed.slice(0, m.index).trim(), percent: Number.parseFloat(m[1]) } : { color: trimmed, percent: null }
}

function readOperandColor(raw: string, variables: Variables): Rgba | null {
  const expanded = expandVariables(raw, variables)
  return parseColor(expanded.toLowerCase().includes('color-mix') ? resolveColorMix(expanded, variables) : expanded)
}

/** One `color-mix(in srgb, a [p%], b [q%])`, as the function defines it: channels weighted by their own alpha. */
function resolveMix(body: string, variables: Variables): string | null {
  const parts = splitArguments(body)
  if (parts.length !== 2) return null
  const [first, second] = parts.map(readOperand)
  const pct = second.percent ?? (first.percent !== null ? 100 - first.percent : 50)
  const w = pct / 100
  const a = readOperandColor(first.color, variables)
  const b = readOperandColor(second.color, variables)
  if (!a || !b) return null
  const alpha = a.a * (1 - w) + b.a * w
  const blend = (x: number, y: number) => (alpha === 0 ? 0 : Math.round((x * a.a * (1 - w) + y * b.a * w) / alpha))
  // Hex rather than rgba(): the replacement must add no parentheses, so an outer mix still matches.
  return `#${[blend(a.r, b.r), blend(a.g, b.g), blend(a.b, b.b), Math.round(alpha * 255)]
    .map((c) => Math.min(Math.max(c, 0), 255).toString(16).padStart(2, '0'))
    .join('')}`
}

function resolveInnermost(css: string, variables: Variables): string {
  let head = ''
  let tail = css
  for (;;) {
    const m = MIX_PATTERN.exec(tail)
    if (!m) return head + tail
    const end = m.index + m[0].length
    if (m[1].toLowerCase().includes('color-mix')) {
      // An outer mix around an inner one: step inside, the outer is worked out on the next pass.
      const opening = m.index + m[0].indexOf('(') + 1
      head += tail.slice(0, opening)
      tail = tail.slice(opening)
      continue
    }
    const replacement = resolveMix(m[1], variables)
    head += replacement === null ? tail.slice(0, end) : tail.slice(0, m.index) + replacement
    tail = tail.slice(end)
  }
}

export function resolveColorMix(css: string, variables: Variables = new Map()): string {
  let resolved = css
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const swept = resolveInnermost(resolved, variables)
    if (swept === resolved) return resolved
    resolved = swept
  }
  return resolved
}

// ─────────────────────────── nesting ───────────────────────────

type StyleNode = { kind: 'declarations'; text: string } | { kind: 'rule'; prelude: string; body: StyleNode[] }

/** At-rules whose blocks are not selectors (animation frames, faces…), kept exactly as written. */
const OPAQUE_AT_RULES = ['@keyframes', '@-webkit-keyframes', '@font-face', '@counter-style', '@property', '@page', '@font-feature-values']

function readString(css: string, from: number): number {
  const quote = css[from]
  let i = from + 1
  while (i < css.length) {
    if (css[i] === '\\') {
      i += 2
      continue
    }
    if (css[i] === quote) return i + 1
    i++
  }
  return i
}

function splitSelectorList(selector: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  let i = 0
  while (i < selector.length) {
    const ch = selector[i]
    if (ch === '"' || ch === "'") {
      const end = readString(selector, i)
      current += selector.slice(i, end)
      i = end
      continue
    }
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
      i++
      continue
    }
    current += ch
    i++
  }
  parts.push(current)
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** Where the declarations before a nested rule end: the last `;` outside brackets and strings. */
function lastDeclarationEnd(text: string): number {
  let depth = 0
  let found = -1
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '"' || ch === "'") {
      i = readString(text, i)
      continue
    }
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth--
    if (ch === ';' && depth === 0) found = i
    i++
  }
  return found
}

function parseNodes(css: string, from: number): { nodes: StyleNode[]; index: number } {
  const nodes: StyleNode[] = []
  let pending = ''
  let i = from
  while (i < css.length) {
    const ch = css[i]
    if (ch === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2)
      i = close === -1 ? css.length : close + 2
      continue
    }
    if (ch === '"' || ch === "'") {
      const end = readString(css, i)
      pending += css.slice(i, end)
      i = end
      continue
    }
    if (ch === '}') break
    if (ch === '{') {
      const cut = lastDeclarationEnd(pending)
      const declarations = cut === -1 ? '' : pending.slice(0, cut + 1).trim()
      const prelude = (cut === -1 ? pending : pending.slice(cut + 1)).trim()
      if (declarations) nodes.push({ kind: 'declarations', text: declarations })
      const inner = parseNodes(css, i + 1)
      nodes.push({ kind: 'rule', prelude, body: inner.nodes })
      pending = ''
      i = inner.index + 1
      continue
    }
    pending += ch
    i++
  }
  const trailing = pending.trim()
  if (trailing) nodes.push({ kind: 'declarations', text: trailing })
  return { nodes, index: i }
}

const serializeNodes = (nodes: StyleNode[]): string =>
  nodes.map((n) => (n.kind === 'declarations' ? n.text : `${n.prelude}{${serializeNodes(n.body)}}`)).join('')

const atRuleName = (prelude: string) => (/^@[\w-]+/.exec(prelude) ?? [''])[0].toLowerCase()

function resolveSelector(child: string, parent: string): string {
  const reference = splitSelectorList(parent).length > 1 ? `:is(${parent})` : parent
  return splitSelectorList(child)
    .map((one) => (one.includes('&') ? one.replace(/&/g, reference) : `${reference} ${one}`))
    .join(',')
}

function flattenNodes(nodes: StyleNode[], parent: string, out: string[]): void {
  let declarations: string[] = []
  const flush = () => {
    if (!declarations.length) return
    const text = declarations.join('')
    out.push(parent ? `${parent}{${text}}` : text)
    declarations = []
  }
  for (const node of nodes) {
    if (node.kind === 'declarations') {
      declarations.push(node.text.endsWith(';') ? node.text : `${node.text};`)
      continue
    }
    flush()
    if (node.prelude.startsWith('@')) {
      if (OPAQUE_AT_RULES.includes(atRuleName(node.prelude))) {
        out.push(`${node.prelude}{${serializeNodes(node.body)}}`)
        continue
      }
      // A condition written inside a rule is hoisted around it.
      const inner: string[] = []
      flattenNodes(node.body, parent, inner)
      out.push(`${node.prelude}{${inner.join('')}}`)
      continue
    }
    flattenNodes(node.body, parent ? resolveSelector(node.prelude, parent) : node.prelude, out)
  }
  flush()
}

function holdsNestedRules(nodes: StyleNode[], insideRule: boolean): boolean {
  return nodes.some((n) => {
    if (n.kind === 'declarations') return false
    if (insideRule) return true
    if (OPAQUE_AT_RULES.includes(atRuleName(n.prelude))) return false
    return holdsNestedRules(n.body, !n.prelude.startsWith('@'))
  })
}

/** Hoist every nested rule to stand alone. A sheet with nothing nested is returned byte for byte. */
export function flattenNesting(css: string): string {
  const parsed = parseNodes(css, 0).nodes
  if (!holdsNestedRules(parsed, false)) return css
  const out: string[] = []
  flattenNodes(parsed, '', out)
  return out.join('')
}

// ─────────────────────────── masks ───────────────────────────

const MASK_DECLARATION = /(^|[;{\s])mask-(image|size|position|repeat)\s*:\s*((?:"[^"]*"|'[^']*'|[^;}"'])+)/g

/** Give every `mask-*` its `-webkit-` twin; a second pass changes nothing. */
export function prefixMasks(css: string): string {
  return css.replace(MASK_DECLARATION, (whole: string, lead: string, property: string, value: string, offset: number, source: string) => {
    const twin = `-webkit-mask-${property}:${value.trim()};`
    const start = offset + lead.length
    if (source.slice(Math.max(0, start - twin.length), start) === twin) return whole
    return `${lead}${twin}mask-${property}:${value.trim()}`
  })
}

// ─────────────────────────── applying it to the page ───────────────────────────

export function applyThemeCompatibility(root: Document | ShadowRoot = document): void {
  if (!needsStyleCompatibility()) return
  const shared = Array.from(root.querySelectorAll<HTMLStyleElement>(INJECTED_STYLES))
  const palettes = Array.from(root.querySelectorAll<HTMLStyleElement>(PALETTE_STYLES))
  const mixes = !supportsColorMix()
  const nesting = !supportsNesting()
  const masks = !supportsUnprefixedMask()

  const variables: Variables = new Map()
  if (mixes) shared.forEach((s) => readVariables(s.textContent ?? '', variables))

  const rewrite = (sheet: HTMLStyleElement, known: Variables) => {
    const css = sheet.textContent ?? ''
    const coloured = mixes && css.includes('color-mix') ? resolveColorMix(css, known) : css
    const flat = nesting ? flattenNesting(coloured) : coloured
    const resolved = masks && flat.includes('mask-') ? prefixMasks(flat) : flat
    // Written only when it changed, so the observer is not answered by its own writing.
    if (resolved !== css) sheet.textContent = resolved
  }
  shared.forEach((s) => rewrite(s, variables))
  palettes.forEach((s) => {
    const own: Variables = new Map(variables)
    if (mixes) readVariables(s.textContent ?? '', own)
    rewrite(s, own)
  })
}

const observers = new WeakMap<Document | ShadowRoot, MutationObserver>()
const watchedPalettes = new WeakSet<HTMLStyleElement>()

/** Repair now, and again whenever the grid writes its sheets (it does on every theme change). */
export function observeThemeCompatibility(root: Document | ShadowRoot = document): void {
  if (!needsStyleCompatibility() || typeof MutationObserver === 'undefined') return
  let observer = observers.get(root)
  if (!observer) {
    const created = new MutationObserver(() => {
      applyThemeCompatibility(root)
      created.takeRecords()
    })
    created.observe('head' in root ? root.head : root, { childList: true, subtree: true, characterData: true })
    observers.set(root, created)
    observer = created
  }
  root.querySelectorAll<HTMLStyleElement>(PALETTE_STYLES).forEach((sheet) => {
    if (watchedPalettes.has(sheet)) return
    watchedPalettes.add(sheet)
    observer!.observe(sheet, { childList: true, subtree: true, characterData: true })
  })
  applyThemeCompatibility(root)
}
