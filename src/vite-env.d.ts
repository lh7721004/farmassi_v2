/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL: string
  readonly VITE_API_URL: string
  readonly VITE_PUBLIC_UPLOAD_BASE: string
  readonly VITE_NAVER_MAP_CLIENT_ID: string
  readonly VITE_VAPID_PUBLIC_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
