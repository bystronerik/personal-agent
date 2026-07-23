import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { config } from 'dotenv'

/**
 * Side-effect module, imported first by `main.ts`. The repo keeps a single
 * `.env` at the workspace root, three levels above this file either compiled or
 * as source, while `dotenv/config` would only look in the working directory.
 */
config({
  path: join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '.env'),
  quiet: true,
})
