import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { discoveryDevProxyPlugin } from './scripts/discoveryDevProxyPlugin.mjs';

export default defineConfig({
  plugins: [react(), discoveryDevProxyPlugin()],
});
