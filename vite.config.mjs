import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { discoveryDevProxyPlugin } from './scripts/discoveryDevProxyPlugin.mjs';
import {
  normalizeSupabaseBaseUrl,
  supabaseDevProxyPlugin,
} from './scripts/supabaseDevProxyPlugin.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL
    ? normalizeSupabaseBaseUrl(env.VITE_SUPABASE_URL)
    : null;

  return {
    plugins: [react(), discoveryDevProxyPlugin(), supabaseDevProxyPlugin(supabaseUrl)],
    publicDir: mode === 'production' ? false : 'public',
  };
});
