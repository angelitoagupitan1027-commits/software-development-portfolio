import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sandbox preview overrides are gated on BASE44_PREVIEW_MODE === '1' so the
// shared config keeps its normal behaviour everywhere else.
const previewMode = process.env.BASE44_PREVIEW_MODE === '1';
const sandboxDomain = process.env.BASE44_SANDBOX_HOST_DOMAIN;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // The preview proxy forwards Host: <port>-<sandbox id>.<sandbox domain>.
    allowedHosts: previewMode && sandboxDomain ? [`.${sandboxDomain}`, 'localhost', '127.0.0.1'] : undefined,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://api:8000',
        changeOrigin: true,
      },
    },
  },
});
