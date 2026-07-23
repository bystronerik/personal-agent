import {
  loadEnv,
  VITE_API_URL,
  VITE_AUTH0_AUDIENCE,
  VITE_AUTH0_CLIENT_ID,
  VITE_AUTH0_DOMAIN,
} from '@personal-agent/env/client'

/**
 * Values are read from `import.meta.env` with explicit static accesses — Vite
 * only inlines `VITE_`-prefixed keys, so no server-side secret is reachable
 * here. The shared loader validates and reports every problem at once.
 */
export const env = loadEnv(
  {
    auth0Domain: VITE_AUTH0_DOMAIN,
    auth0ClientId: VITE_AUTH0_CLIENT_ID,
    auth0Audience: VITE_AUTH0_AUDIENCE,
    apiUrl: VITE_API_URL,
  },
  {
    source: {
      VITE_AUTH0_DOMAIN: import.meta.env.VITE_AUTH0_DOMAIN,
      VITE_AUTH0_CLIENT_ID: import.meta.env.VITE_AUTH0_CLIENT_ID,
      VITE_AUTH0_AUDIENCE: import.meta.env.VITE_AUTH0_AUDIENCE,
      VITE_API_URL: import.meta.env.VITE_API_URL,
    },
    subject: 'The admin portal',
  },
)
