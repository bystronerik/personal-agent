import type { INestApplication } from '@nestjs/common'
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger'
import { cleanupOpenApiDoc } from 'nestjs-zod'

import { postProcessOpenApiDoc } from './openapi-postprocess'

/**
 * Shared by the served `/docs` and by `scripts/emit-openapi.ts`, so the
 * generated document and the live one cannot describe different APIs.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Personal Agent admin API')
    .setDescription('Control panel for the morning/evening brief agent')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build()

  return postProcessOpenApiDoc(
    cleanupOpenApiDoc(SwaggerModule.createDocument(app, config)),
  )
}
