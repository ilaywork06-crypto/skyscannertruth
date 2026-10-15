/**
 * Build and dev-server configuration.
 */

import { hostname } from 'node:os'
import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import vuetify from 'vite-plugin-vuetify'

/** Where the assumptions API is reached while developing. */
const API_TARGET = process.env.TRUTH_API_URL ?? 'http://localhost:8000'

/** The oldest browsers the client is built for. */
const BROWSER_TARGETS = ['chrome90', 'edge90', 'firefox90', 'safari15']

/**
 * Host names the dev server answers to. The machine's own name is always allowed; `TRUTH_ALLOWED_HOSTS`
 * adds more (comma separated) and `all` disables the check.
 */
const allowedHosts = (): string[] | true => {
  const named = (process.env.TRUTH_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

  if (named.includes('all')) {
    return true
  }

  const own = hostname()

  return [...new Set([...named, own, `${own}.local`, 'localhost'])]
}

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    port: 5174,
    allowedHosts: allowedHosts(),
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  build: {
    outDir: 'dist',
    target: BROWSER_TARGETS,
    chunkSizeWarningLimit: 1600,
  },
  optimizeDeps: {
    esbuildOptions: { target: BROWSER_TARGETS },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
