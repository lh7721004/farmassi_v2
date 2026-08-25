/// <reference types="vite/client" />

/** 빌드 시점에 vite 가 넣는 값 (vite.config.ts 의 define). */
declare const __APP_VERSION__: string
declare const __APP_COMMIT__: string

interface ImportMetaEnv {
  readonly VITE_SITE_URL: string
  readonly VITE_API_URL: string
  readonly VITE_PUBLIC_UPLOAD_BASE: string
  readonly VITE_KAKAO_JS_KEY: string
  readonly VITE_VAPID_PUBLIC_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
