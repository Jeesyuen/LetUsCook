import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // RUNPOD_API_KEY has no VITE_ prefix, so it stays in the dev server and never reaches the browser bundle
  const { RUNPOD_API_KEY } = loadEnv(mode, import.meta.dirname, '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': `${import.meta.dirname}/src` } },
    server: {
      proxy: {
        '/api/runpod': {
          target: 'https://api.runpod.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/runpod/, ''),
          headers: RUNPOD_API_KEY ? { Authorization: `Bearer ${RUNPOD_API_KEY}` } : undefined,
        },
      },
    },
  }
})
