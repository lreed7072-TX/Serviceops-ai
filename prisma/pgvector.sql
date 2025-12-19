-- Optional pgvector support (run manually if your Postgres has the extension installed).
-- This keeps pgvector usage opt-in while the app stores embeddings as JSON by default.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KbChunk"
  ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

CREATE INDEX IF NOT EXISTS kb_chunk_embedding_vector_idx
  ON "KbChunk" USING ivfflat (embedding_vector vector_cosine_ops);
