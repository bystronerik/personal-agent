import { Controller, Get, HttpStatus, Logger } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ZodResponse } from 'nestjs-zod'

import type { Health } from '@personal-agent/schemas/health'

import { Public } from '../auth/public.decorator'
import { PrismaService } from '../prisma/prisma.service'
// Value import: `emitDecoratorMetadata` records the DTO class at runtime, and a
// type-only import would leave the serializer nothing to parse with.
import { HealthDto } from './health.dto'

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name)

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ operationId: 'checkHealth' })
  @ZodResponse({
    status: HttpStatus.OK,
    type: HealthDto,
    description: 'Whether the API and its database are reachable',
  })
  async check(): Promise<Health> {
    const db = await this.probeDatabase()
    return { status: db === 'ok' ? 'ok' : 'degraded', db }
  }

  private async probeDatabase(): Promise<Health['db']> {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`
      return 'ok'
    } catch (error) {
      // The route is public and a driver error names the host, port, database
      // and user, so the reason is logged rather than returned.
      this.logger.error(
        'Database health probe failed',
        error instanceof Error ? error.stack : String(error),
      )
      return 'unreachable'
    }
  }
}
