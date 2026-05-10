import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth/login': 'http://localhost:3001',
      '/auth/register': { target: 'http://localhost:3001', bypass: (req) => {
        if (req.method === 'GET') return req.url  // GET vai para o React
      }},
      '/auth/verificar-email': 'http://localhost:3001',
      '/api': 'http://localhost:3001',
    }
  }
})