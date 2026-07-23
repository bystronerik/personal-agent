import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common'
import { createPrismaClient, type PrismaClient } from '@personal-agent/db'

import { API_CONFIG } from '../config/config.module'
import type { ApiConfig } from '../config/env'

/**
 * Connecting is lazy: Prisma dials on first query, so `NestFactory.create()`
 * works with no database running (see `scripts/emit-openapi.ts`).
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient

  constructor(@Inject(API_CONFIG) config: ApiConfig) {
    this.client = createPrismaClient(config.databaseUrl)
  }

  onModuleDestroy(): Promise<void> {
    return this.client.$disconnect()
  }
}
