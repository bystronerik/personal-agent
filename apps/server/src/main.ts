import './env-file'
import 'reflect-metadata'

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module'
import type { ApiConfig } from './config/config'
import { API_CONFIG } from './config/config.module'
import { buildOpenApiDocument } from './openapi'

const app = await NestFactory.create(AppModule)
const config = app.get<ApiConfig>(API_CONFIG)

app.enableCors({ origin: config.corsOrigin })
app.enableShutdownHooks()

SwaggerModule.setup('docs', app, buildOpenApiDocument(app), {
  jsonDocumentUrl: 'openapi.json',
})

await app.listen(config.port)
new Logger('Bootstrap').log(`API listening on http://localhost:${config.port}`)
