-- The agent fuses two rankers: cosine distance over `embedding`, already
-- indexed, and Postgres full-text over title+summary, which without this is a
-- sequential scan and a recomputed tsvector per row per query.
--
-- The expression must match `sources/corpus.ts` exactly — same regconfig, same
-- concatenation — or the planner ignores the index and silently falls back to
-- the scan. `summary` is NOT NULL, so no COALESCE is needed to keep it
-- IMMUTABLE.

-- CreateIndex
CREATE INDEX "articles_fts_idx" ON "articles"
  USING gin (to_tsvector('english', title || ' ' || summary));
