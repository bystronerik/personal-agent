import { DATABASE_URL, loadEnv } from '@personal-agent/env'

/**
 * Separate from `loadAgentConfig` so importing the agent core still requires no
 * database — only the worker reads this.
 */
const WORKER_ENV = {
  databaseUrl: DATABASE_URL,
}

export const loadWorkerConfig = (source: NodeJS.ProcessEnv = process.env) =>
  loadEnv(WORKER_ENV, { source, subject: 'The brief worker' })

export type WorkerConfig = ReturnType<typeof loadWorkerConfig>
