import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Aceita conexões de outros dispositivos da rede local (http://<ip>:5173)
    host: true,
    proxy: {
      '/api': 'http://localhost:3001',
      '/imagens': 'http://localhost:3001',
    }
  }
})