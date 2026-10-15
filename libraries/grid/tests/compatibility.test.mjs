/**
 * The regression check behind the nesting half of `src/compatibility.ts`.
 *
 * The table library writes a good hundred of its rules inside other rules, and a browser older than Chrome
 * 112 throws every one of them away. The shim hoists them out, and this is what says it hoists them out to
 * the same place the browser would have put them: the rules AG Grid actually ships are read out of the
 * installed package with a real parser, flattened, and compared declaration by declaration against what
 * postcss resolves from the nested original.
 *
 * Run with `npm run test --workspace @truth-platform/grid`, which needs nothing but the packages the
 * repository already installs.
 */

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const acorn = require('acorn')
const postcss = require('postcss')

const HERE = fileURLToPath(new URL('.', import.meta.url))
const SOURCE = join(HERE, '..', 'src', 'compatibility.ts')
/* The package hides its files behind `exports`, so the entry it does offer is what gets read. */
const GRID = require.resolve('ag-grid-community')

/* The shim is written for the browser, so it is built the way the client builds it before being called. */
const build = () => {
  const directory = mkdtempSync(join(tmpdir(), 'grid-compat-'))
  const bundle = join(directory, 'compatibility.cjs')
  execFileSync(
    require.resolve('esbuild/bin/esbuild'),
    [SOURCE, '--bundle', '--format=cjs', '--platform=node', `--outfile=${bundle}`, '--log-level=warning'],
  )

  /* The shim remembers what the browser answered, so a scenario that fakes another browser needs its own copy. */
  const fresh = () => {
    delete require.cache[bundle]

    return require(bundle)
  }

  return { module: require(bundle), fresh, clean: () => rmSync(directory, { recursive: true, force: true }) }
}

/**
 * Read every stylesheet the grid ships out of its own module, with a parser rather than with a search.
 *
 * A search over minified source starts inside a string sooner or later and reads half a stylesheet as if it
 * were the whole of one, which is a test that fails for reasons that have nothing to do with the shim.
 */
const gridStylesheets = () => {
  const found = []
  const walk = (node) => {
    if (node === null || typeof node !== 'object') {
      return
    }
    if (Array.isArray(node)) {
      node.forEach(walk)

      return
    }
    if (node.type === 'Literal' && typeof node.value === 'string') {
      found.push(node.value)
    }
    if (node.type === 'TemplateLiteral') {
      node.quasis.forEach((quasi) => found.push(quasi.value.cooked ?? ''))
    }
    Object.keys(node).forEach((key) => {
      if (key !== 'type' && key !== 'start' && key !== 'end') {
        walk(node[key])
      }
    })
  }
  walk(acorn.parse(readFileSync(GRID, 'utf8'), { ecmaVersion: 'latest', sourceType: 'script' }))

  return found.filter(
    (text) =>
      text.length > 500 &&
      text.includes('{') &&
      text.includes('.ag-') &&
      !/function |=>|\breturn \b/.test(text) &&
      (text.match(/[;:]/g) ?? []).length / text.length > 0.02,
  )
}

/* ---- the yardstick: a second resolution, written differently, over postcss's own reading ---- */

const OPAQUE = /^@(-webkit-)?(keyframes|font-face|counter-style|property|page|font-feature-values)/i

const wrap = (selector) => (postcss.list.comma(selector).length > 1 ? `:is(${selector})` : selector)

const resolveAgainst = (child, parent) =>
  postcss.list
    .comma(child)
    .map((one) => (one.includes('&') ? one.split('&').join(wrap(parent)) : `${wrap(parent)} ${one}`))
    .join(',')

/** Every declaration of a sheet as the selector and conditions it ends up under, in document order. */
const declarations = (css) => {
  const out = []
  const walk = (container, selector, conditions) => {
    container.each((node) => {
      if (node.type === 'decl') {
        out.push(`${selector}|${conditions.join('&&')}|${node.prop}:${node.value}`)
      } else if (node.type === 'rule') {
        walk(node, selector ? resolveAgainst(node.selector, selector) : node.selector, conditions)
      } else if (node.type === 'atrule') {
        if (OPAQUE.test(`@${node.name}`)) {
          out.push(`opaque|@${node.name} ${node.params}|${node.toString().replace(/\s+/g, '')}`)

          return
        }
        walk(node, selector, [...conditions, `@${node.name} ${node.params}`])
      }
    })
  }
  walk(postcss.parse(css), '', [])

  return out
}

/* ---- the cases the grid does not happen to write, checked against what the syntax means ---- */

const CASES = [
  ['a sheet that never nested is handed back untouched', '.a{color:red}', '.a{color:red}'],
  ['the nesting selector becomes the rule around it', '.a{color:red;&:hover{color:blue}}', '.a{color:red;}.a:hover{color:blue;}'],
  ['a rule nested under a combinator alone', '.a{color:red;>*{color:blue}}', '.a{color:red;}.a >*{color:blue;}'],
  ['a rule nested under nothing is a descendant', '.a{color:red;.b{color:blue}}', '.a{color:red;}.a .b{color:blue;}'],
  ['a parent that is a list is wrapped first', '.a,.b{color:red;&:hover{color:blue}}', '.a,.b{color:red;}:is(.a,.b):hover{color:blue;}'],
  ['every selector of a nested list gets the parent', '.a{&:hover,&:focus{color:blue}}', '.a:hover,.a:focus{color:blue;}'],
  ['a declaration after a nested rule stays after it', '.a{color:red;&:hover{color:blue}color:green}', '.a{color:red;}.a:hover{color:blue;}.a{color:green;}'],
  ['the nesting selector may stand anywhere', '.b{.a &{color:red}}', '.a .b{color:red;}'],
  ['nesting inside nesting', '.a{&:hover{&:focus{color:red}}}', '.a:hover:focus{color:red;}'],
  ['a condition inside a rule is hoisted around it', '.a{color:red;@media (width>50px){color:blue}}', '.a{color:red;}@media (width>50px){.a{color:blue;}}'],
  ['a condition at the top keeps its rules', '@media print{.a{color:red;&:hover{color:blue}}}', '@media print{.a{color:red;}.a:hover{color:blue;}}'],
  ['the frames of an animation are not selectors', '@keyframes s{0%{opacity:0}to{opacity:1}}', '@keyframes s{0%{opacity:0}to{opacity:1}}'],
  ['a brace inside a string does not close a block', '.a{content:"}";&:hover{color:red}}', '.a{content:"}";}.a:hover{color:red;}'],
  ['a semicolon inside brackets does not end a declaration', '.a{background:url(x;y);&:hover{color:red}}', '.a{background:url(x;y);}.a:hover{color:red;}'],
  ['a comment holding a brace is stepped over', '.a{/* } */color:red;&:hover{color:blue}}', '.a{color:red;}.a:hover{color:blue;}'],
  ['a face is left exactly as it was written', '@font-face{font-family:x;src:url(y)}.a{&:hover{color:red}}', '@font-face{font-family:x;src:url(y)}.a:hover{color:red;}'],
]

/* ---- running them ---- */

const { module: compatibility, fresh, clean } = build()
const { flattenNesting, prefixMasks, readVariables, resolveColorMix } = compatibility

let failures = 0

const fail = (name, detail) => {
  failures += 1
  console.log(`FAIL  ${name}\n      ${detail.split('\n').join('\n      ')}`)
}

CASES.forEach(([name, input, expected]) => {
  let actual
  try {
    actual = flattenNesting(input)
  } catch (error) {
    fail(name, `threw ${error.message}`)

    return
  }
  if (actual !== expected) {
    fail(name, `in       ${input}\nexpected ${expected}\ngot      ${actual}`)

    return
  }
  console.log(`ok    ${name}`)
})

const sheets = gridStylesheets()
let nested = 0
let compared = 0

sheets.forEach((css, index) => {
  const flat = flattenNesting(css)
  const name = `stylesheet ${index + 1} of ${sheets.length}`

  if (/&/.test(flat)) {
    fail(name, 'a nesting selector survived the rewrite')

    return
  }

  let before
  let after
  try {
    before = declarations(css)
    after = declarations(flat)
    postcss.parse(flat).walkRules((rule) => {
      if (rule.parent?.type === 'rule') {
        throw new Error(`a rule is still nested: ${rule.selector}`)
      }
    })
  } catch (error) {
    fail(name, error.message)

    return
  }

  postcss.parse(css).walkRules((rule) => {
    if (rule.parent?.type === 'rule') {
      nested += 1
    }
  })

  if (before.length !== after.length) {
    fail(name, `${before.length} declarations became ${after.length}`)

    return
  }

  const drifted = before.findIndex((entry, at) => entry !== after[at])
  if (drifted !== -1) {
    fail(name, `declaration ${drifted}\nexpected ${before[drifted]}\ngot      ${after[drifted]}`)

    return
  }

  compared += before.length
})

/* ---- the mask half: every icon of every shipped sheet carries the prefixed twin older Chrome reads ---- */

let masks = 0
sheets.forEach((css, index) => {
  const once = prefixMasks(flattenNesting(css))
  const name = `masks of stylesheet ${index + 1} of ${sheets.length}`
  if (prefixMasks(once) !== once) {
    fail(name, 'a second pass changed the sheet again')

    return
  }

  postcss.parse(once).walkDecls(/^mask-(image|size|position|repeat)$/, (decl) => {
    masks += 1
    const twin = decl.prev()
    if (twin?.type !== 'decl' || twin.prop !== `-webkit-${decl.prop}` || twin.value !== decl.value) {
      fail(name, `${decl.prop}:${decl.value.slice(0, 40)} has no prefixed twin before it`)
    }
  })
})

/*
 * The palette the grid writes for each table, which is where nearly every mix lives. Its colours are written
 * as fallbacks behind the properties a parent table would hand down, and those properties are written in
 * terms of the ones reading them, so a reading that followed them would never reach a colour. The modes a
 * page never picks set the same properties to other mixes, and must not replace the ones the table reads.
 */
const palette = require('ag-grid-community')
  .themeQuartz.withParams({ backgroundColor: '#000000', foregroundColor: '#ffffff', accentColor: '#1F75FE' })
  ._getPerGridCss('ag-theme-params-1')
const paletteVariables = new Map()
readVariables(palette, paletteVariables)
const resolvedPalette = flattenNesting(resolveColorMix(palette, paletteVariables))
const leftover = (resolvedPalette.match(/color-mix/g) ?? []).length
if (leftover > 0) {
  fail('palette', `${leftover} mixes were left unresolved`)
}
const uncheckedBorder = /--ag-checkbox-unchecked-border-color:[^;]*?(#[0-9a-f]{8})/.exec(resolvedPalette)
/* Thirty percent of white over black, which is what the table reads outside any mode. */
if (uncheckedBorder?.[1] !== '#4d4d4dff') {
  fail('palette', `the unchecked checkbox border came out ${uncheckedBorder?.[1] ?? 'unresolved'}`)
}
if ([...paletteVariables.keys()].some((name) => name.startsWith('--ag-inherited-'))) {
  fail('palette', 'a property handed down to nested tables was read as part of the palette')
}

/* ---- colours: a fractional alpha is a fraction (the original divided it by 255) ---- */

const { parseColor } = compatibility
const half = parseColor('rgba(10, 20, 30, 0.5)')
if (!half || Math.abs(half.a - 0.5) > 1e-9) {
  fail('alpha', `rgba(…, 0.5) read as alpha ${half?.a}`)
} else {
  console.log('ok    a fractional alpha is read as a fraction')
}
const mixedHalf = resolveColorMix('color-mix(in srgb, rgba(0, 0, 0, 0.5), #ffffff 50%)')
if (mixedHalf !== '#aaaaaabf') {
  fail('alpha', `a half-transparent operand mixed to ${mixedHalf}`)
} else {
  console.log('ok    a half-transparent operand is weighted by its alpha')
}

/*
 * Whether nesting is read at all is asked by parsing a nested rule, not by `CSS.supports('selector(&)')`:
 * Chrome 109 answers yes to the latter and still drops every nested rule, which left every icon of the table
 * a solid square. Both browsers below claim `&`; only the one whose style rule holds a rule reads nesting.
 */
const probeNesting = (styleRule) => {
  const style = { textContent: '', sheet: { cssRules: [styleRule] } }
  globalThis.CSS = { supports: () => true }
  globalThis.document = {
    implementation: {
      createHTMLDocument: () => ({ createElement: () => style, head: { appendChild: () => style } }),
    },
  }
  try {
    return fresh().supportsNesting()
  } finally {
    delete globalThis.CSS
    delete globalThis.document
  }
}

if (probeNesting({}) !== false) {
  fail('nesting probe', 'a browser that only claims `&` was taken to read nested rules')
} else {
  console.log('ok    a browser that only claims `&` still has its sheets flattened')
}
if (probeNesting({ cssRules: [{}] }) !== true) {
  fail('nesting probe', 'a browser that reads nested rules was taken not to')
} else {
  console.log('ok    a browser that reads nested rules keeps its sheets as written')
}

clean()

console.log(`${masks} mask declarations carry their prefixed twin`)
console.log(`the palette of a table resolves all of its mixes`)

console.log(
  `\n${CASES.length} cases, ${sheets.length} shipped stylesheets, ${nested} nested rules, ` +
    `${compared} declarations compared`,
)
console.log(failures === 0 ? 'every rule lands where the syntax says it should' : `${failures} check(s) FAILED`)
process.exit(failures === 0 ? 0 : 1)
