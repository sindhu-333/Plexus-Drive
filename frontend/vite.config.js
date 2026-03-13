import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0', // Listen on all available interfaces
    open: true,
    // This will make Vite automatically detect and use your current IP
    strictPort: false,
    // Allow ngrok and other external hosts
    allowedHosts: [
      'localhost',
      '.ngrok.dev',
      '.ngrok-free.dev',
      'uncabled-finley-madly.ngrok-free.dev'
    ],
    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:5000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  css: {
    postcss: './postcss.config.js'
  }
})