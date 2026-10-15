/**
 * The register's build: Vue, the API proxy for development, and a browser floor stated rather than inherited -
 * the client is opened on workstations as old as Chrome 90.
 *
 * `/api` is forwarded to TRUTH_API_URL with the prefix stripped, so `/api/assumption` reaches the assumptions
 * API as `/assumption` (the same as nginx does in the image).
 */
import { hostname } from 'node:os'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const API_TARGET = process.env.TRUTH_API_URL ?? 'http://localhost:8000'
const BROWSER_TARGETS = ['chrome90', 'edge90', 'firefox90', 'safari15']

/**
 * Which names the dev server answers to. It refuses a Host it was not told about (that is what stops a page on
 * the internet pointing its own domain at this machine); an IP address is always accepted, the machine's own
 * name is allowed, others are named in TRUTH_ALLOWED_HOSTS (`.example.com` for every name under one), and `all`
 * gives the protection up.
 */
function allowedHosts(): string[] | true {
  const named = (process.env.TRUTH_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean)
  if (named.includes('all')) return true
  const own = hostname()
  return [...new Set([...named, own, `${own}.local`, 'localhost'])]
}

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: true,
    port: 5174,
    allowedHosts: allowedHosts(),
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  preview: { port: 5174 },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000, target: BROWSER_TARGETS },
  optimizeDeps: { exclude: ['@truth-platform/ui', '@truth-platform/grid'], esbuildOptions: { target: BROWSER_TARGETS } },
})
