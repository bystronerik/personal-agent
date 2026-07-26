# `@personal-agent/embedding`

The OpenRouter embeddings client, and the one place the query/document asymmetry
is written down. A leaf: it depends on nothing but `@openrouter/sdk`. Two
consumers — `apps/ingest`, which embeds documents, and `apps/agent`, which embeds
queries. See the [root CLAUDE.md](../../CLAUDE.md) for the workspace-wide picture.

## Why this is a package and not a helper in each app

Because it is **one contract with two halves, applied by two apps.**

`qwen/qwen3-embedding-8b` is instruction-tuned. A document is embedded as plain
text; a query has to be wrapped:

```
Instruct: Given a web search query, retrieve relevant news articles that answer the query
Query: <the query>
```

Getting that wrong does not degrade retrieval subtly — it breaks it, with no
error and no bad-looking output. Measured against the live corpus: bare, *"oil and
energy prices"* returned three ECB survey releases and none of the ten EIA
petroleum articles; instructed, all three top hits were EIA crude-oil stories.

`apps/ingest` writes the document side and `apps/agent` reads the query side, so
nothing but this package stops them drifting apart. Hence **two functions rather
than one with a flag**: `embedDocuments` and `embedQuery` cannot be confused by
forgetting an argument.

`vectorLiteral` is here for the same reason: pgvector takes a vector as the
string `'[1,2,3]'` cast to `halfvec`, never as an array parameter, and both apps
that touch `articles.embedding` have to spell that the same way. `Embedding` is
the type it and the two embed functions share.

## Two things a caller must know

- **`dimensions` must equal the width of `articles.embedding`.** The model returns
  4096 natively and is asked to truncate; Postgres rejects a mismatch at insert
  with an error naming neither the model nor the request, so `client.ts` checks
  the width itself and fails with both. Both apps select the same three variables
  from `packages/env`, which is what keeps them agreeing.
- **Instructed distances are larger in absolute terms** even as ranking becomes
  correct. A threshold tuned on bare queries is meaningless. Rank; do not
  threshold, until there is data to calibrate against.

`embed` batches: one request per call, and the response carries the `index` each
vector belongs to, which is what the sort restores — order is not promised.
`index` is *optional* on the wire, so a row without one falls back to its
position.

## The SDK, and the two options that are not defaults

`client.ts` calls `@openrouter/sdk`'s `embeddings.generate` rather than
`fetch`ing `/api/v1/embeddings` itself, so the request shape, the response parse
and the per-status error classes come from the generated client. Its errors are
raised untouched: `OpenRouterError` carries `statusCode` and `body`, which is
what a caller logging a failed poll needs.

Two of its defaults are wrong for this path and are overridden in `RETRY_CONFIG`
and `RETRY_CODES`:

- **The default backoff runs for an hour.** A poll cycle or a 07:00 brief is
  worthless long before that, so the ceiling is 30 seconds.
- **The default retries 5XX only.** The corpus is embedded in batches, so 429 is
  the failure this path actually meets, and it is added.

The SDK is constructed per call because `EmbeddingConfig` arrives per call; it is
a plain object, and the fetch it wraps dominates. A third argument still injects
a `fetch` — it becomes the `HTTPClient`'s `fetcher`, which is the whole test seam
in `client.test.ts` and the reason these tests need no network and no mocking
library.

Because both apps **bundle** this package and the SDK stays external to that
bundle, each of them declares `@openrouter/sdk` in its own manifest — see the
root `CLAUDE.md`.

## Conventions

- **Do not write comments.** Two exceptions: a non-obvious contract a caller
  would otherwise violate, and genuinely dense logic. Never write a comment that
  restates the next line — `// load the config` above `loadConfig()` is the
  failure mode. If a variable needs a comment, rename the variable.
