import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const DEV_PORT = 5173

/**
 * Loads the repo-root .env. Only `VITE_`-prefixed keys are copied, and Vite
 * inlines them into the browser bundle — so nothing secret may carry that
 * prefix. The Auth0 SPA client uses PKCE and has no secret to leak.
 */
export default defineConfig({
  envDir: '../..',
  plugins: [react()],
  server: { port: DEV_PORT },
})
