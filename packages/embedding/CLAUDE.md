# @personal-agent/embedding

The OpenRouter embeddings client. `src/index.ts` exports `embedDocuments()`,
`embedQuery()`, `vectorLiteral()` and `RETRIEVAL_INSTRUCTION`. `apps/ingest` writes
documents and `apps/agent` reads with queries. The package imports no workspace package;
each caller passes an `EmbeddingConfig`.

## Scripts

| Script | Effect |
| --- | --- |
| `test` | Vitest. `src/client.test.ts` drives the client with an injected `fetch` |
| `build` | `tsc` only |

## Structure

- `src/client.ts` — one request for a whole batch. It restores the input order from the
  `index` field, and it rejects a vector of the wrong width with a clear message.
- `src/text.ts` — the query and document asymmetry. Read the comment before you change
  either half.
- `src/vector.ts` — `vectorLiteral()` makes the `'[1,2,3]'` string that pgvector needs.

## Gotchas

- The model is instruction-tuned. A query must go through `embedQuery`, which adds the
  retrieval instruction. A document must go through `embedDocuments`, which sends plain
  text. A query that is sent as a document does not degrade retrieval; it breaks it.
  There are two functions, and not one flag, for this reason.
- `dimensions` must equal the width of the `articles.embedding` column. The client
  checks this, because the Postgres error names neither the model nor the width.
- A vector reaches Postgres as a string that is cast to `halfvec`, never as an array
  parameter.
- Both apps must use the same model and the same width. The variables are declared one
  time in `packages/env`.
