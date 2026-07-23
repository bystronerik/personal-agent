import { defineConfig } from 'orval'

export default defineConfig({
  client: {
    input: { target: '../server/src/generated/openapi.yaml' },
    output: {
      mode: 'tags-split',
      target: 'src/generated/api',
      schemas: 'src/generated/api/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: './src/lib/api-fetcher.ts', name: 'apiFetch' },
        query: { version: 5, signal: true },
      },
    },
  },
})
