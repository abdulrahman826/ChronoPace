import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Respects an assigned PORT (e.g. from the preview harness when 5173 is
    // already taken by another session) while still defaulting to 5173 for
    // a plain `npm run dev`.
    port: Number(process.env.PORT) || 5173,
  },
})
