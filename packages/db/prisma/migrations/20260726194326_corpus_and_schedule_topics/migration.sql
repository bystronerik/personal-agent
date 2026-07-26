-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- DropForeignKey
ALTER TABLE "topics" DROP CONSTRAINT "topics_user_id_fkey";

-- DropIndex
DROP INDEX "topics_user_id_subject_key";

-- AlterTable
ALTER TABLE "topics" ADD COLUMN     "schedule_id" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feed_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "embedding" halfvec(4000) NOT NULL,
    "embedding_model" TEXT NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_deliveries" (
    "schedule_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "brief_run_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "article_deliveries_pkey" PRIMARY KEY ("schedule_id","article_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sources_feed_url_key" ON "sources"("feed_url");

-- CreateIndex
CREATE UNIQUE INDEX "articles_url_key" ON "articles"("url");

-- CreateIndex
CREATE INDEX "articles_published_at_idx" ON "articles"("published_at");

-- CreateIndex
CREATE INDEX "topics_user_id_idx" ON "topics"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_schedule_id_subject_key" ON "topics"("schedule_id", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_id_user_id_key" ON "schedules"("id", "user_id");

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_schedule_id_user_id_fkey" FOREIGN KEY ("schedule_id", "user_id") REFERENCES "schedules"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_deliveries" ADD CONSTRAINT "article_deliveries_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_deliveries" ADD CONSTRAINT "article_deliveries_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
-- qwen/qwen3-embedding-8b returns 4096 dimensions, which no pgvector index
-- accepts: an HNSW entry must fit one 8 kB page, and `vector` costs 4 bytes per
-- dimension (capping it at 2000) against `halfvec`'s 2 (capping it at 4000).
-- halfvec(4000) is the widest indexable embedding — 97.6% of the model's output,
-- with fp16 precision that cosine ranking does not notice. Ingest asks the model
-- for `dimensions: 4000`, an MRL truncation it supports; that request and this
-- column must agree, and nothing checks it but the first insert.
--
-- This name must stay in step with `@@index([embedding], map: ...)` in
-- schema.prisma. Prisma has no HNSW index type, so without a datamodel entry to
-- match it against, `migrate dev` reads an index it cannot express and emits a
-- DROP for it on every run. The diff compares name and columns only, never the
-- access method, which is what lets a declared btree stand in for this.
CREATE INDEX "articles_embedding_idx" ON "articles"
    USING hnsw ("embedding" halfvec_cosine_ops);
