import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './load.mjs'

const ui = await load()
const FSI = '⁨'
const PDI = '⁩'

test('every colour theme defines every custom property in both modes', () => {
  const names = (css) => css.split('; ').map((d) => d.split(':')[0]).sort()
  const expected = names(ui.themeCss(ui.DEFAULT_ACCENT, 'light'))
  for (const accent of ui.ACCENTS) {
    for (const mode of ['light', 'dark']) {
      const css = ui.themeCss(accent, mode)
      assert.deepEqual(names(css), expected, `${accent}/${mode}`)
      assert.doesNotMatch(css, /undefined|NaN/, `${accent}/${mode}`)
    }
  }
})

test('theme css is plain rgb channels, readable by browsers without color-mix or lch', () => {
  const css = ui.themeCss('indigo', 'dark')
  assert.match(css, /--background: \d+ \d+ \d+;/)
  assert.match(css, /color-scheme: dark/)
  assert.doesNotMatch(css, /lch\(|oklch\(|color-mix\(/)
})

test('indigo is the default colour theme', () => {
  assert.equal(ui.DEFAULT_ACCENT, 'indigo')
})

test('translate isolates interpolated values and leaves unknown placeholders alone', () => {
  ui.registerTranslations({ en: { 'test.greeting': 'Hello {name}, {missing}' } })
  assert.equal(ui.translate('test.greeting', { name: 'שלום' }), `Hello ${FSI}שלום${PDI}, {missing}`)
})

test('translate falls back to the key when no dictionary has the phrase', () => {
  assert.equal(ui.translate('test.nowhere'), 'test.nowhere')
  assert.equal(ui.hasPhrase('test.nowhere'), false)
})

test('bidi helpers', () => {
  assert.equal(ui.isolate(''), '')
  assert.equal(ui.joinIsolated(['a', '', 'b']), `${FSI}a${PDI}, ${FSI}b${PDI}`)
  assert.equal(ui.valueDirection('ניסוי'), 'auto')
  assert.equal(ui.valueDirection('2026-10-15'), undefined)
})

test('keys out of names', () => {
  assert.equal(ui.toKey('  Max altitude (m) '), 'Max_altitude_m')
  assert.equal(ui.slugify('Flight Test #2'), 'flight_test_2')
  assert.equal(ui.isValidKey('max_alt'), true)
  assert.equal(ui.isValidKey('max-alt'), false)
  assert.equal(ui.humanizeKey('event_type.keys'), 'Event Type Keys')
  assert.equal(ui.truncate('abcdef', 4), 'abc…')
})

test('a date input round-trips through the stored moment on the same local day', () => {
  const iso = ui.toIsoDate('2026-10-01')
  assert.ok(iso.endsWith('Z'))
  assert.equal(ui.toDateInput(iso), '2026-10-01')
  assert.equal(ui.toIsoDate(''), null)
  assert.equal(ui.toIsoDate('not a date'), null)
})

test('bytes are formatted', () => {
  assert.equal(ui.formatBytes(0), '0 B')
  assert.equal(ui.formatBytes(512), '512 B')
  assert.match(ui.formatBytes(1536), /^1\.5 KB$/)
})

test('coordinates are validated and accept both stored forms', () => {
  assert.deepEqual(ui.toCoordinate({ lon: 34.8, lat: 32.1, alt: 10 }), { lon: 34.8, lat: 32.1, alt: 10 })
  assert.deepEqual(ui.toCoordinate([34.8, 32.1]), { lon: 34.8, lat: 32.1, alt: null })
  assert.equal(ui.toCoordinate({ lon: 200, lat: 0 }), null)
  assert.equal(ui.toCoordinate('nowhere'), null)
  assert.equal(ui.formatCoordinate({ lon: 1, lat: 2, alt: null }), '2.00000, 1.00000')
})

test('field dependencies read the form first and the event second', () => {
  const dep = { field: 'rate', operator: 'equals', values: [200] }
  assert.equal(ui.dependencyHolds(dep, { rate: 200 }), true)
  assert.equal(ui.dependencyHolds(dep, {}, { rate: 200 }), true)
  assert.equal(ui.dependencyHolds(dep, { rate: null }, { rate: 200 }), false)
  assert.equal(ui.dependencyHolds({ field: 'x', operator: 'has_value', values: [] }, { x: [] }), false)
  assert.equal(ui.dependencyHolds({ field: 'x', operator: 'is_empty', values: [] }, { x: '' }), true)
  assert.equal(ui.dependencyHolds({ field: 'x', operator: 'not_equals', values: ['a'] }, { x: 'b' }), true)
  assert.equal(ui.dependenciesHold([dep, { field: 'x', operator: 'has_value', values: [] }], { rate: 200, x: 'y' }), true)
})
