import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': `${import.meta.dirname}/src` } },
  server: {
    proxy: {
      '/api/runpod': {
        target: 'https://api.runpod.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/runpod/, ''),
      },
    },
  },
})

