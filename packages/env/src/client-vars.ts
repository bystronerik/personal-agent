import { z } from 'zod'

import { envVar } from './load'

// Browser variables, read from `import.meta.env`. Reached only through the
// `./client` subpath, which never imports `./server-vars`, so a server variable
// cannot be pulled into the browser bundle even by mistake. These are
// `VITE_`-prefixed — Vite inlines them, so nothing secret may carry that prefix.

export const VITE_AUTH0_DOMAIN = envVar(
  'VITE_AUTH0_DOMAIN',
  z.string().min(1, 'is required'),
)

export const VITE_AUTH0_CLIENT_ID = envVar(
  'VITE_AUTH0_CLIENT_ID',
  z.string().min(1, 'is required'),
)

export const VITE_AUTH0_AUDIENCE = envVar(
  'VITE_AUTH0_AUDIENCE',
  z.string().min(1, 'is required'),
)

export const VITE_API_URL = envVar('VITE_API_URL', z.url('must be a URL'))
