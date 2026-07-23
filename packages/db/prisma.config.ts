import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DATABASE_URL, envVar, loadEnv } from '@personal-agent/env'
import { config as loadDotenv } from 'dotenv'
import { defineConfig } from 'prisma/config'

/** What docker-compose.yml serves, and what .env.example points at. */
const DEFAULT_DATABASE_URL = 'postgresql://agent:agent@localhost:5432/agent'

// Falling back rather than requiring the variable keeps `prisma generate` —
// which never opens a connection — working on a fresh clone. The default is
// applied here rather than on the shared declaration so `apps/server` still
// fails at boot on a missing URL instead of dialling localhost.
const CLI_ENV = {
  url: envVar(
    DATABASE_URL.name,
    DATABASE_URL.schema.default(DEFAULT_DATABASE_URL),
  ),
}

const packageDir = dirname(fileURLToPath(import.meta.url))

// Prisma 7 does not read .env on its own, and the repo keeps a single .env at
// the workspace root rather than one per package.
loadDotenv({ path: join(packageDir, '..', '..', '.env'), quiet: true })

const { url } = loadEnv(CLI_ENV, { source: process.env, subject: 'Prisma' })

export default defineConfig({
  schema: join(packageDir, 'prisma', 'schema.prisma'),
  migrations: {
    path: join(packageDir, 'prisma', 'migrations'),
  },
  datasource: { url },
})
