import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
// Thin database layer. Production uses PostgreSQL through `pg`; tests and the
// local homologation server use PGlite (PostgreSQL compiled to WASM) with the
// same SQL, selected by DATABASE_URL=pglite:memory or pglite:<directory>.
export type Queryable = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]>;
};
export type Db = Queryable & {
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
};
export async function openDb(url: string): Promise<Db> {
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const target = url.slice("pglite:".length);
    const pg = new PGlite(target === "memory" ? undefined : target);
    const wrap = (client: {
      query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
    }): Queryable => ({
      query: async <T>(sql: string, params: unknown[] = []) =>
        (await client.query(sql, params)).rows as T[],
    });
    return {
      ...wrap(pg),
      transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
      exec: async (sql) => void (await pg.exec(sql)),
      close: () => pg.close(),
    };
  }
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: url, max: 5 });
  return {
    query: async <T>(sql: string, params: unknown[] = []) =>
      (await pool.query(sql, params)).rows as T[],
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn({
          query: async <T>(sql: string, params: unknown[] = []) =>
            (await client.query(sql, params)).rows as T[],
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    exec: async (sql) => void (await pool.query(sql)),
    close: () => pool.end(),
  };
}
// Applies db/migrations/*.sql once each, in name order.
export async function migrate(
  db: Db,
  dir = join(process.cwd(), "db/migrations"),
) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied = new Set(
    (
      await db.query<{ name: string }>("SELECT name FROM schema_migrations")
    ).map((row) => row.name),
  );
  const pending = readdirSync(dir)
    .filter((file) => file.endsWith(".sql") && !applied.has(file))
    .sort();
  for (const file of pending)
    await db.transaction(async (tx) => {
      for (const statement of splitSql(readFileSync(join(dir, file), "utf8")))
        await tx.query(statement);
      await tx.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
        file,
      ]);
    });
  return pending;
}
// Migrations hold plain DDL (no functions or quoted semicolons), so splitting
// on statement ends after dropping line comments is enough.
function splitSql(sql: string) {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}
