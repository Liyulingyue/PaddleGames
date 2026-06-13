import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5178,
    proxy: {
      '/api': {
        target: 'http://localhost:7080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:7080',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        portal: resolve(__dirname, 'apps/portal/index.html'),
      },
    },
  },
})
