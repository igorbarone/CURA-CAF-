import { createHash } from "node:crypto";
import type { BaristaConfig } from "./barista-config";
import type { UsageStore } from "./barista-store";
// Server-side limits for the Barista (never trusted to the browser):
// per hashed IP (minute and day), per anonymous session (day), a global
// daily request cap and a global daily token budget. Counts happen before
// the model is called; tokens are added after the answer.
export type LimitResult =
  | { ok: true }
  | {
      ok: false;
      code: "rate_limited" | "daily_limit" | "budget_exhausted";
      retryAfterSeconds: number;
    };

const minuteStart = (now: Date) =>
  new Date(Math.floor(now.getTime() / 60_000) * 60_000);
const dayStart = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const secondsToTomorrow = (now: Date) =>
  Math.ceil((dayStart(now).getTime() + 86_400_000 - now.getTime()) / 1000);

/** Irreversible identifier: raw IPs and session ids are never stored. */
export function hashId(secret: string, value: string, now = new Date()) {
  return createHash("sha256")
    .update(`${secret}|${dayStart(now).toISOString()}|${value}`)
    .digest("hex")
    .slice(0, 32);
}

export async function checkLimits(
  store: UsageStore,
  config: BaristaConfig,
  ids: { ip: string; session: string },
  now = new Date(),
): Promise<LimitResult> {
  const day = dayStart(now);
  const tokens = await store.read("global:tokens", day);
  if (
    tokens.inputTokens >= config.limits.dailyInputTokens ||
    tokens.outputTokens >= config.limits.dailyOutputTokens
  )
    return {
      ok: false,
      code: "budget_exhausted",
      retryAfterSeconds: secondsToTomorrow(now),
    };
  const minute = await store.hit(`ip:${ids.ip}:m`, minuteStart(now));
  if (minute > config.limits.ipPerMinute)
    return {
      ok: false,
      code: "rate_limited",
      retryAfterSeconds: 60 - now.getUTCSeconds(),
    };
  const checks: [string, number][] = [
    [`ip:${ids.ip}:d`, config.limits.ipPerDay],
    [`session:${ids.session}:d`, config.limits.sessionPerDay],
    ["global:requests", config.limits.dailyRequests],
  ];
  for (const [bucket, limit] of checks)
    if ((await store.hit(bucket, day)) > limit)
      return {
        ok: false,
        code: "daily_limit",
        retryAfterSeconds: secondsToTomorrow(now),
      };
  if (Math.random() < 0.01)
    await store.cleanup(new Date(day.getTime() - 2 * 86_400_000));
  return { ok: true };
}

export async function recordTokens(
  store: UsageStore,
  input: number,
  output: number,
  now = new Date(),
) {
  await store.addTokens("global:tokens", dayStart(now), input, output);
}

/** Per-instance concurrency guard (one answer at a time per session). */
export function concurrencyGuard(max: number) {
  const sessions = new Set<string>();
  let active = 0;
  return {
    acquire(session: string) {
      if (active >= max || sessions.has(session)) return null;
      active++;
      sessions.add(session);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        active--;
        sessions.delete(session);
      };
    },
  };
}
