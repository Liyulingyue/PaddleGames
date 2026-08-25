import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// 自签 HTTPS 证书（WebCodecs 需要安全上下文）
const certPath = path.resolve(__dirname, '../cert.pem')
const keyPath = path.resolve(__dirname, '../key.pem')
const httpsConfig = fs.existsSync(certPath) && fs.existsSync(keyPath)
  ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
  : undefined

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: httpsConfig ? 'https://localhost:8000' : 'http://localhost:8000',
        changeOrigin: true,
        secure: false, // 允许自签证书
      },
      '/videos': {
        target: httpsConfig ? 'https://localhost:8000' : 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
