import '../env-file'
import './openapi-env'
import 'reflect-metadata'

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NestFactory } from '@nestjs/core'
import { dump } from 'js-yaml'

import { AppModule } from '../app.module'
import { buildOpenApiDocument } from '../openapi'

/**
 * Builds the document without listening or touching Postgres — Prisma connects
 * lazily, so a full application context is cheap here.
 */
const app = await NestFactory.create(AppModule, { logger: false })
await app.init()

const document = buildOpenApiDocument(app)
await app.close()

// From `src/scripts/` up to the package root, then into `src/generated`.
const outputDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'src',
  'generated',
)
const outputPath = join(outputDir, 'openapi.yaml')

mkdirSync(outputDir, { recursive: true })
writeFileSync(outputPath, dump(document, { lineWidth: -1 }), 'utf8')
console.log(`Wrote ${outputPath}`)
