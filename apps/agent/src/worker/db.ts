import { createPrismaClient, type PrismaClient } from '@personal-agent/db'

import { loadWorkerConfig } from './config'

let client: PrismaClient | undefined

/** Memoized like `llm/client.ts`, and lazy so a test needs no connection string. */
export function workerDb(): PrismaClient {
  client ??= createPrismaClient(loadWorkerConfig().databaseUrl)
  return client
}

export async function disconnectDb(): Promise<void> {
  await client?.$disconnect()
  client = undefined
}
