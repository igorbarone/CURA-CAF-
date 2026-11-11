-- Barista Cura (CURA Experience): usage counters for distributed rate limits
-- and the daily budget. No message content and no raw IP is stored: buckets
-- are hashed identifiers. Rows older than two days are deleted by the app.
CREATE TABLE IF NOT EXISTS barista_usage (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);
CREATE INDEX IF NOT EXISTS barista_usage_window ON barista_usage (window_start);
