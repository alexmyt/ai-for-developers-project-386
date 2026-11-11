import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // В dev UI и API живут на разных портах; в проде Nest отдаёт статику сам.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
