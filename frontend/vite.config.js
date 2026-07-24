import { defineConfig } from 'vite'
import react     from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    allowedHosts: ["frutransport.luisepzsls.dev"],
    proxy: {
      // Redirige /api/* al backend Express en puerto 5000
      '/api': {
        target:      'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
