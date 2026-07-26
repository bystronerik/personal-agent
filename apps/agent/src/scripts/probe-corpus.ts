import { parseArgs } from 'node:util'

import { disconnectDb } from '../db'
import { corpusProvider } from '../sources/corpus'
import { runScript } from './run-script'

/**
 * What the research agent would see for a query, without paying for a brief.
 * The one way to tell a bad brief caused by retrieval from one caused by the
 * prompt.
 */
const { values, positionals } = parseArgs({
  options: {
    window: { type: 'string', default: '72' },
    limit: { type: 'string', default: '5' },
    fetch: { type: 'boolean', default: false },
  },
  allowPositionals: true,
})

await runScript(async () => {
  const query = positionals.join(' ')
  if (!query) {
    throw new Error(
      'Usage: pnpm probe-corpus "central bank rate decision" [--window 72] [--limit 5] [--fetch]',
    )
  }

  const sources = corpusProvider({ windowHours: Number(values.window) })
  try {
    const results = await sources.search(query, Number(values.limit))
    console.log(
      `"${query}" — ${results.length} result(s) in the last ${values.window}h\n`,
    )
    for (const result of results) {
      console.log(`  ${result.publishedAt.slice(0, 10)}  ${result.title}`)
      console.log(`              ${result.id}`)
    }

    if (values.fetch && results[0]) {
      const doc = await sources.fetch(results[0].id)
      console.log(`\nfetch_article(${results[0].id}):\n${doc?.body}`)
    }
  } finally {
    await disconnectDb()
  }
})
