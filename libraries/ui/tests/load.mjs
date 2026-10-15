/*
 * The library is TypeScript written for the browser, so the tests build the modules they read with esbuild,
 * the way the clients build them, into one throwaway ES module.
 */
import { build } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

export async function load() {
  const dir = mkdtempSync(join(tmpdir(), 'ui-tests-'))
  const outfile = join(dir, 'bundle.mjs')
  try {
    await build({
      stdin: {
        contents: `
          export * from './theme/palette'
          export * from './i18n/index'
          export * from './lib/bidi'
          export * from './lib/format'
          export * from './lib/coordinates'
          export * from './lib/dependencies'
        `,
        resolveDir: SRC,
        loader: 'ts',
      },
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile,
      logLevel: 'silent',
    })
    return await import(pathToFileURL(outfile).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
