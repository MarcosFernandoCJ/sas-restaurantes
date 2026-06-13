import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// API_TARGET solo lo usa el proxy del dev-server de Vite (desarrollo local sin Docker).
// Con Docker+nginx el browser nunca toca este proxy — nginx enruta /api y /socket.io.
const API_TARGET = process.env.API_TARGET ?? 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/socket.io': {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
})
