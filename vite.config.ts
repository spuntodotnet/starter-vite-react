import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Reachable from outside the sandbox, on its port URL (https://sbx-<id>-5173.<domain>).
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
})
