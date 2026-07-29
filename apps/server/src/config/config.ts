import {
  API_PORT,
  AUTH0_AUDIENCE,
  AUTH0_DOMAIN,
  AUTH0_MANAGEMENT_CLIENT_ID,
  AUTH0_MANAGEMENT_CLIENT_SECRET,
  CORS_ORIGIN,
  DATABASE_URL,
  loadEnv,
  UNSUBSCRIBE_SECRET,
} from '@personal-agent/env'

const API_ENV = {
  databaseUrl: DATABASE_URL,
  auth0Domain: AUTH0_DOMAIN,
  auth0Audience: AUTH0_AUDIENCE,
  auth0ManagementClientId: AUTH0_MANAGEMENT_CLIENT_ID,
  auth0ManagementClientSecret: AUTH0_MANAGEMENT_CLIENT_SECRET,
  port: API_PORT,
  corsOrigin: CORS_ORIGIN,
  unsubscribeSecret: UNSUBSCRIBE_SECRET,
}

export function loadApiConfig(source: NodeJS.ProcessEnv = process.env) {
  return loadEnv(API_ENV, { source, subject: 'The API' })
}

export type ApiConfig = ReturnType<typeof loadApiConfig>
