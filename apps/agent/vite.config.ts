import { defineConfig } from 'vitest/config'

/**
 * Loads the repo-root .env for evalite runs; already-set variables still win.
 * `envPrefix` is required — Vite only copies matching keys into `process.env`,
 * and it defaults to `VITE_`. It also governs what a Vite *client* build would
 * inline, so this list must stay Node-only secrets and this package must stay
 * unbundled for the browser.
 */
export default defineConfig({
  envDir: '../..',
  envPrefix: ['OPENROUTER_'],
})
