/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the browser sends API requests. Defaults to `/api`. */
  readonly VITE_API_BASE_URL?: string
  /** Who the client creates things as - there is no user management. */
  readonly VITE_DEFAULT_CREATOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
