import { createPrismaClient, type PrismaClient } from '@personal-agent/db'

import { loadIngestConfig } from './config'

let client: PrismaClient | undefined

/** Lazy and memoized, so importing a module needs no connection string. */
export function ingestDb(): PrismaClient {
  client ??= createPrismaClient(loadIngestConfig().databaseUrl)
  return client
}

export async function disconnectDb(): Promise<void> {
  await client?.$disconnect()
  client = undefined
}
