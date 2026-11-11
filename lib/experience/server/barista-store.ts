import { openDb, type Queryable } from "../../commerce/server/db";
// Usage counters for the Barista. PostgreSQL makes the limits shared by every
// serverless instance; the in-memory store protects a single process only
// and is accepted solely for local development (BARISTA_ALLOW_MEMORY_LIMITS).
export type UsageStore = {
  /** Atomically counts a hit in the window and returns the new count. */
  hit(bucket: string, windowStart: Date): Promise<number>;
  read(
    bucket: string,
    windowStart: Date,
  ): Promise<{ hits: number; inputTokens: number; outputTokens: number }>;
  addTokens(
    bucket: string,
    windowStart: Date,
    input: number,
    output: number,
  ): Promise<void>;
  cleanup(before: Date): Promise<void>;
};

export function memoryStore(): UsageStore {
  const rows = new Map<
    string,
    { hits: number; inputTokens: number; outputTokens: number }
  >();
  const key = (bucket: string, start: Date) =>
    `${bucket}|${start.toISOString()}`;
  const row = (k: string) => {
    let value = rows.get(k);
    if (!value)
      rows.set(k, (value = { hits: 0, inputTokens: 0, outputTokens: 0 }));
    return value;
  };
  return {
    async hit(bucket, start) {
      return ++row(key(bucket, start)).hits;
    },
    async read(bucket, start) {
      return {
        ...(rows.get(key(bucket, start)) ?? {
          hits: 0,
          inputTokens: 0,
          outputTokens: 0,
        }),
      };
    },
    async addTokens(bucket, start, input, output) {
      const value = row(key(bucket, start));
      value.inputTokens += input;
      value.outputTokens += output;
    },
    async cleanup(before) {
      for (const k of rows.keys())
        if (new Date(k.split("|")[1]) < before) rows.delete(k);
    },
  };
}

const ensure = `CREATE TABLE IF NOT EXISTS barista_usage (
  bucket text NOT NULL, window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0, input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0, PRIMARY KEY (bucket, window_start))`;

export function sqlStore(db: Queryable): UsageStore {
  let ready: Promise<unknown> | null = null;
  const init = () => (ready ??= db.query(ensure));
  return {
    async hit(bucket, start) {
      await init();
      const [row] = await db.query<{ hits: number }>(
        `INSERT INTO barista_usage (bucket, window_start, hits) VALUES ($1, $2, 1)
         ON CONFLICT (bucket, window_start) DO UPDATE SET hits = barista_usage.hits + 1
         RETURNING hits`,
        [bucket, start.toISOString()],
      );
      return Number(row.hits);
    },
    async read(bucket, start) {
      await init();
      const [row] = await db.query<{
        hits: number;
        input_tokens: string;
        output_tokens: string;
      }>(
        "SELECT hits, input_tokens, output_tokens FROM barista_usage WHERE bucket = $1 AND window_start = $2",
        [bucket, start.toISOString()],
      );
      return row
        ? {
            hits: Number(row.hits),
            inputTokens: Number(row.input_tokens),
            outputTokens: Number(row.output_tokens),
          }
        : { hits: 0, inputTokens: 0, outputTokens: 0 };
    },
    async addTokens(bucket, start, input, output) {
      await init();
      await db.query(
        `INSERT INTO barista_usage (bucket, window_start, input_tokens, output_tokens) VALUES ($1, $2, $3, $4)
         ON CONFLICT (bucket, window_start) DO UPDATE SET
           input_tokens = barista_usage.input_tokens + EXCLUDED.input_tokens,
           output_tokens = barista_usage.output_tokens + EXCLUDED.output_tokens`,
        [bucket, start.toISOString(), input, output],
      );
    },
    async cleanup(before) {
      await init();
      await db.query("DELETE FROM barista_usage WHERE window_start < $1", [
        before.toISOString(),
      ]);
    },
  };
}

let shared: Promise<UsageStore> | null = null;
export function usageStore(databaseUrl: string) {
  shared ??= databaseUrl
    ? openDb(databaseUrl).then((db) => sqlStore(db))
    : Promise.resolve(memoryStore());
  shared.catch(() => {
    shared = null;
  });
  return shared;
}
