import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { log } from "../../commerce/server/log";
import {
  lessonIndex,
  type BaristaData,
  type ShopSnapshot,
} from "../barista-tools";
import { loadShop } from "./barista-shop";
import { getExperience } from "../content";
import { readBaristaConfig, type BaristaConfig } from "./barista-config";
import {
  checkLimits,
  concurrencyGuard,
  hashId,
  recordTokens,
} from "./barista-limits";
import { usageStore, type UsageStore } from "./barista-store";
import {
  anthropicModel,
  runBaristaTurn,
  sessionContextSchema,
  type BaristaEvent,
  type BaristaModel,
} from "./barista-ai";

// HTTP handler for /api/barista (server build only; the static export has no
// API and the interface falls back to the guided mode). Protections, in
// order: configuration, same-origin + custom header, payload size and shape,
// distributed rate limits and daily budget, per-instance concurrency, a hard
// timeout, and bounded history and output. Message text is never logged.
const MAX_BODY_BYTES = 24_000;
const requestSchema = z
  .object({
    sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(40),
    context: sessionContextSchema.default({}),
  })
  .strict()
  .refine(
    (body) => body.messages[body.messages.length - 1].role === "user",
    "last message must be the user's",
  )
  .refine(
    (body) => body.messages[body.messages.length - 1].content.length <= 500,
    "message too long",
  );

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });

export type HandlerDeps = {
  config: BaristaConfig;
  store: () => Promise<UsageStore>;
  model: () => BaristaModel;
  data: () => BaristaData;
  // Store prices and availability for consultarCompra (optional).
  shop?: () => Promise<ShopSnapshot | undefined>;
  now?: () => Date;
};

export function defaultDeps(): HandlerDeps {
  const config = readBaristaConfig();
  let data: BaristaData | null = null;
  return {
    config,
    store: () => usageStore(config.databaseUrl),
    model: () => anthropicModel(config),
    data: () => {
      if (!data) {
        const experience = getExperience();
        data = { ...experience, lessons: lessonIndex(experience.academy) };
      }
      return data;
    },
    shop: () => loadShop().catch(() => undefined),
  };
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function createBaristaHandler(deps: HandlerDeps) {
  const guard = concurrencyGuard(deps.config.maxConcurrency);
  const status = () =>
    json({
      enabled: deps.config.enabled,
      mode: deps.config.enabled ? "ai" : "guided",
      reason: deps.config.reason,
      limits: deps.config.enabled ? { messageChars: 500 } : undefined,
    });

  async function post(request: Request) {
    const { config } = deps;
    if (!config.enabled)
      return json({ error: "ai_unavailable", reason: config.reason }, 503);
    if (!sameOrigin(request) || request.headers.get("x-cura-barista") !== "1")
      return json({ error: "forbidden" }, 403);
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_BODY_BYTES)
      return json({ error: "payload_too_large" }, 413);
    let raw: string;
    try {
      raw = await request.text();
    } catch {
      return json({ error: "invalid_request" }, 400);
    }
    if (raw.length > MAX_BODY_BYTES)
      return json({ error: "payload_too_large" }, 413);
    let body: z.infer<typeof requestSchema>;
    try {
      const parsed = requestSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) return json({ error: "invalid_request" }, 400);
      body = parsed.data;
    } catch {
      return json({ error: "invalid_request" }, 400);
    }
    const now = deps.now?.() ?? new Date();
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const ids = {
      ip: hashId(config.hashSecret, `ip:${ip}`, now),
      session: hashId(config.hashSecret, `s:${body.sessionId}`, now),
    };
    let store: UsageStore;
    try {
      store = await deps.store();
    } catch {
      log("barista.store_unavailable");
      return json(
        { error: "ai_unavailable", reason: "store_unavailable" },
        503,
      );
    }
    const limit = await checkLimits(store, config, ids, now).catch(() => null);
    if (!limit)
      return json(
        { error: "ai_unavailable", reason: "store_unavailable" },
        503,
      );
    if (!limit.ok) {
      log("barista.limited", { code: limit.code });
      return json(
        { error: limit.code, retryAfterSeconds: limit.retryAfterSeconds },
        429,
        {
          "Retry-After": String(limit.retryAfterSeconds),
        },
      );
    }
    const release = guard.acquire(ids.session);
    if (!release) return json({ error: "busy" }, 429, { "Retry-After": "5" });

    // Keep the context small: the last 12 turns are enough for a chat.
    // Bounded context = bounded cost: the last N messages, with earlier
    // Barista replies trimmed (the latest question is kept whole).
    const history = body.messages
      .slice(-config.historyMessages)
      .map((turn, index, all) =>
        index === all.length - 1 || turn.role === "user"
          ? turn
          : { ...turn, content: turn.content.slice(0, config.historyChars) },
      );
    if (history[0].role !== "user") history.shift();
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), config.timeoutMs);
    const signal = AbortSignal.any([request.signal, timeout.signal]);
    const encoder = new TextEncoder();
    const startedAt = Date.now();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: BaristaEvent) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            /* client went away */
          }
        };
        try {
          const result = await runBaristaTurn({
            model: deps.model(),
            data: { ...deps.data(), shop: await deps.shop?.() },
            history,
            context: body.context,
            maxSteps: config.maxSteps,
            signal,
            emit,
          });
          await recordTokens(
            store,
            result.inputTokens,
            result.outputTokens,
            now,
          ).catch(() => undefined);
          log("barista.answer", {
            ms: Date.now() - startedAt,
            stop: result.stop,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            actions: result.actions.length,
          });
        } catch (error) {
          const code = timeout.signal.aborted
            ? "timeout"
            : request.signal.aborted
              ? "cancelled"
              : error instanceof Anthropic.RateLimitError
                ? "provider_busy"
                : error instanceof Anthropic.AuthenticationError ||
                    error instanceof Anthropic.PermissionDeniedError
                  ? "provider_misconfigured"
                  : error instanceof Anthropic.APIError
                    ? "provider_unavailable"
                    : "internal_error";
          log("barista.error", { code, ms: Date.now() - startedAt });
          emit({
            type: "error",
            code,
            message:
              code === "timeout"
                ? "A resposta demorou demais. Tente de novo com uma pergunta mais curta."
                : code === "cancelled"
                  ? "Resposta cancelada."
                  : "O Barista com IA está indisponível agora. Você pode continuar no modo guiado.",
          });
        } finally {
          clearTimeout(timer);
          release();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      },
      cancel() {
        clearTimeout(timer);
        release();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  return { GET: status, POST: post };
}
