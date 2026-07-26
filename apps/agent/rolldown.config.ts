import { isAbsolute } from 'node:path'

import { defineConfig } from 'rolldown'

/**
 * Internal packages export TypeScript, so they are bundled in rather than
 * resolved at runtime; every other bare specifier — node builtins included —
 * stays external and comes from the `--prod` install.
 *
 * `external` is consulted twice per import: once with the written specifier and
 * again with the resolved absolute path. `isAbsolute` is what covers the second
 * pass — without it every module resolves to external and the build still
 * succeeds, emitting an entry that imports the source tree it was meant to
 * inline.
 *
 * Bundling flattens the graph, so what the workspace packages import becomes
 * this app's to declare — hence the Prisma and grammY dependencies in
 * `package.json` that no file under `src/` names.
 */
const BUNDLED = '@personal-agent/'

const isBundled = (id: string) =>
  id.startsWith('.') || isAbsolute(id) || id.startsWith(BUNDLED)

export default defineConfig({
  input: 'src/worker/main.ts',
  platform: 'node',
  external: (id) => !isBundled(id),
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: 'main.js',
  },
})
