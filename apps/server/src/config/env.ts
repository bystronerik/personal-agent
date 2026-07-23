import {
  API_PORT,
  AUTH0_AUDIENCE,
  AUTH0_DOMAIN,
  CORS_ORIGIN,
  DATABASE_URL,
  loadEnv,
} from '@personal-agent/env'

const API_ENV = {
  databaseUrl: DATABASE_URL,
  auth0Domain: AUTH0_DOMAIN,
  auth0Audience: AUTH0_AUDIENCE,
  port: API_PORT,
  corsOrigin: CORS_ORIGIN,
}

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env) {
  return loadEnv(API_ENV, { source: env, subject: 'The API' })
}

export type ApiConfig = ReturnType<typeof loadApiConfig>
