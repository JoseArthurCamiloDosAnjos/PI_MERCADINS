import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 'localhost' = apenas localhost (não mostra Network IPs)
    // Para acesso externo: npm run dev -- --host
    host: 'localhost',
    proxy: {
      '/api': 'http://localhost:3001',
      '/imagens': 'http://localhost:3001',
    },
  },
})