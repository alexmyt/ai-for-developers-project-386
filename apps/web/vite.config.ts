import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // В dev UI и API живут на разных портах; в проде Nest отдаёт статику сам.
    // API_ORIGIN переопределяет цель для e2e-смоука (apps/e2e), который
    // поднимает собранный API на свободном порту.
    proxy: {
      '/api': process.env.API_ORIGIN ?? 'http://localhost:3000',
    },
  },
})
