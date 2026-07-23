import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from './generated/client'

/**
 * Prisma 7 requires a driver adapter for every database. Every caller goes
 * through here so the adapter and its options are configured in one place.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}
