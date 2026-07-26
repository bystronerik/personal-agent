import { isAbsolute } from 'node:path'

import { defineConfig } from 'rolldown'

/**
 * `external` is consulted twice per import: once with the written specifier and
 * again with the resolved absolute path. `isAbsolute` covers the second pass —
 * without it every module resolves to external and the build still succeeds,
 * emitting an entry that imports the source tree it was meant to inline.
 *
 * Bundling flattens the graph, so what the workspace packages import becomes this
 * app's to declare — hence the Prisma dependencies in `package.json` that no file
 * under `src/` names.
 */
const BUNDLED = '@personal-agent/'

const isBundled = (id: string) =>
  id.startsWith('.') || isAbsolute(id) || id.startsWith(BUNDLED)

export default defineConfig({
  input: 'src/main.ts',
  platform: 'node',
  external: (id) => !isBundled(id),
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: 'main.js',
  },
})
