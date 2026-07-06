/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POC_EXTENSION_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_DEV_PROXY?: string;
  readonly VITE_PHASE101_FORCE_CLOUD_FAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
