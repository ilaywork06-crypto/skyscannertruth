/**
 * The inventory's build: Vue, the API proxies for development, and a browser floor stated rather than
 * inherited - the client is opened on workstations as old as Chrome 90.
 */
import { hostname } from 'node:os'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const EVENTS = process.env.EVENTS_SERVICE_URL ?? 'http://localhost:8000'
const STORAGE = process.env.STORAGE_SERVICE_URL ?? 'http://localhost:8001'
const NOTIFICATIONS = process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:8002'
const BROWSER_TARGETS = ['chrome90', 'edge90', 'firefox90', 'safari15']

/**
 * Which names the dev server answers to. It refuses a Host it was not told about (that is what stops a page on
 * the internet pointing its own domain at this machine); the machine's own name is allowed, others are named in
 * SKYSCANNER_ALLOWED_HOSTS, and `all` gives the protection up.
 */
function allowedHosts(): string[] | true {
  const named = (process.env.SKYSCANNER_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim()).filter(Boolean)
  if (named.includes('all')) return true
  const own = hostname()
  return [...new Set([...named, own, `${own}.local`, 'localhost'])]
}

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: true,
    port: 5173,
    allowedHosts: allowedHosts(),
    proxy: {
      '/api/storage': { target: STORAGE, changeOrigin: true },
      '/api/notifications': { target: NOTIFICATIONS, changeOrigin: true },
      '/api': { target: EVENTS, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000, target: BROWSER_TARGETS },
  optimizeDeps: { exclude: ['@truth-platform/ui', '@truth-platform/grid'], esbuildOptions: { target: BROWSER_TARGETS } },
})
