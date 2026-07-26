import { createPrismaClient, type PrismaClient } from '@personal-agent/db'

import { loadDatabaseConfig } from './config'

let client: PrismaClient | undefined

/**
 * One client for the whole process, shared by the corpus provider and the
 * worker. Lazy, so importing either needs no connection string — which is what
 * keeps the evals and unit tests running with no database.
 */
export function agentDb(): PrismaClient {
  client ??= createPrismaClient(loadDatabaseConfig().databaseUrl)
  return client
}

export async function disconnectDb(): Promise<void> {
  await client?.$disconnect()
  client = undefined
}
