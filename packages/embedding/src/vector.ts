export type Embedding = number[]

/**
 * pgvector's wire format: a vector reaches Postgres as the string `'[1,2,3]'`
 * cast to `halfvec`, never as an array parameter. Both apps that touch
 * `articles.embedding` — the one that writes it and the one that searches it —
 * have to spell it the same way, for the same reason they share `dimensions`.
 */
export const vectorLiteral = (embedding: Embedding): string =>
  `[${embedding.join(',')}]`
