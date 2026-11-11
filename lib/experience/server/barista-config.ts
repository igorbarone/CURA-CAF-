import { z } from "zod";
// Barista Cura server configuration, from environment variables only.
// The AI is OFF unless every requirement is met; the reason is reported
// (without secrets) so the interface can fall back to the guided mode.
const int = (fallback: number) =>
  z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .transform((value) => value ?? fallback);
const schema = z.object({
  BARISTA_AI: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_AUTH_TOKEN: z.string().optional(),
  BARISTA_MODEL: z
    .string()
    .regex(/^[a-z0-9.-]+$/)
    .optional(),
  BARISTA_EFFORT: z.enum(["low", "medium", "high"]).optional(),
  BARISTA_MAX_OUTPUT_TOKENS: int(1000),
  BARISTA_HISTORY_MESSAGES: int(10),
  BARISTA_HISTORY_CHARS: int(800),
  BARISTA_MAX_STEPS: int(4),
  BARISTA_TIMEOUT_MS: int(30000),
  BARISTA_MAX_CONCURRENCY: int(6),
  BARISTA_LIMIT_IP_PER_MINUTE: int(6),
  BARISTA_LIMIT_IP_PER_DAY: int(60),
  BARISTA_LIMIT_SESSION_PER_DAY: int(40),
  BARISTA_DAILY_REQUESTS: int(1000),
  BARISTA_DAILY_INPUT_TOKENS: int(4_000_000),
  BARISTA_DAILY_OUTPUT_TOKENS: int(400_000),
  BARISTA_HASH_SECRET: z.string().optional(),
  BARISTA_ALLOW_MEMORY_LIMITS: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
});
// Claude Haiku 5.5: the lowest-cost current model ($0.10 / $0.50 per MTok
// for prompts up to 100K tokens). It has no server-side refusal fallback, and
// the Barista never sends one: no automatic escalation to a pricier model.
export const DEFAULT_BARISTA_MODEL = "claude-haiku-5-5";
export type BaristaConfig = ReturnType<typeof readBaristaConfig>;

export function readBaristaConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const raw = schema.parse(env);
  const model = raw.BARISTA_MODEL || DEFAULT_BARISTA_MODEL;
  const databaseUrl = raw.DATABASE_URL || raw.POSTGRES_URL || "";
  const memoryLimits = raw.BARISTA_ALLOW_MEMORY_LIMITS === "true";
  const credential = !!(raw.ANTHROPIC_API_KEY || raw.ANTHROPIC_AUTH_TOKEN);
  const reason =
    raw.BARISTA_AI !== "enabled"
      ? "disabled"
      : !credential
        ? "missing_credentials"
        : !databaseUrl && !memoryLimits
          ? "missing_rate_limit_store"
          : null;
  return {
    enabled: reason === null,
    reason,
    model,
    effort: raw.BARISTA_EFFORT ?? "low",
    // Thinking counts toward max_tokens; at low effort 1000 leaves room for a
    // short reply. Hitting it ends the answer honestly (never runs a tool).
    maxOutputTokens: Math.min(raw.BARISTA_MAX_OUTPUT_TOKENS, 4000),
    historyMessages: Math.min(raw.BARISTA_HISTORY_MESSAGES, 20),
    historyChars: Math.min(raw.BARISTA_HISTORY_CHARS, 2000),
    maxSteps: Math.min(raw.BARISTA_MAX_STEPS, 6),
    timeoutMs: Math.min(raw.BARISTA_TIMEOUT_MS, 60000),
    maxConcurrency: raw.BARISTA_MAX_CONCURRENCY,
    limits: {
      ipPerMinute: raw.BARISTA_LIMIT_IP_PER_MINUTE,
      ipPerDay: raw.BARISTA_LIMIT_IP_PER_DAY,
      sessionPerDay: raw.BARISTA_LIMIT_SESSION_PER_DAY,
      dailyRequests: raw.BARISTA_DAILY_REQUESTS,
      dailyInputTokens: raw.BARISTA_DAILY_INPUT_TOKENS,
      dailyOutputTokens: raw.BARISTA_DAILY_OUTPUT_TOKENS,
    },
    hashSecret: raw.BARISTA_HASH_SECRET ?? "",
    store: databaseUrl ? ("postgres" as const) : ("memory" as const),
    databaseUrl,
  };
}
