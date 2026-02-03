import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyDirBeforeWrite: true
  },
  server: {
    port: 5173,
    proxy: {
      '/render': 'http://localhost:3456'
    }
  }
})
