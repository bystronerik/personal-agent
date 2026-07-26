/**
 * `qwen/qwen3-embedding-8b` is instruction-tuned: a **query** is wrapped in this
 * task description, a **document** is embedded as plain text. Sending a bare
 * query does not degrade retrieval subtly — it breaks it. Measured against the
 * live corpus: "oil and energy prices" returned three ECB survey releases and
 * none of the ten EIA petroleum articles bare; instructed, all three top hits
 * were EIA crude-oil stories.
 *
 * The two halves live in one module because they are one contract, applied by
 * two different apps — `apps/ingest` writes documents, `apps/agent` reads with
 * queries — and nothing but this file stops them drifting apart.
 */
export const RETRIEVAL_INSTRUCTION =
  'Given a web search query, retrieve relevant news articles that answer the query'

export const asQuery = (query: string): string =>
  `Instruct: ${RETRIEVAL_INSTRUCTION}\nQuery: ${query}`
