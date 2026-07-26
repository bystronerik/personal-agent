import { isAbsolute } from 'node:path'

import { defineConfig } from 'rolldown'

/**
 * Internal packages export TypeScript, so they are bundled in rather than
 * resolved at runtime; every other bare specifier stays external and comes from
 * the `--prod` install. Nest lazily `require`s optional platform packages it may
 * never load, which a bundler cannot follow — externalising by shape rather than
 * by list is what keeps that from becoming an unresolved-import error.
 *
 * The oxc helpers are the exception: they back the decorator transform, so they
 * must be inlined or the runtime would need a build-time package.
 *
 * `external` is consulted twice per import: once with the written specifier and
 * again with the resolved absolute path. `isAbsolute` is what covers the second
 * pass — without it every module resolves to external and the build still
 * succeeds, emitting an entry that imports the source tree it was meant to
 * inline.
 */
const BUNDLED = ['@personal-agent/', '@oxc-project/runtime']

const isBundled = (id: string) =>
  id.startsWith('.') || isAbsolute(id) || BUNDLED.some((p) => id.startsWith(p))

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
