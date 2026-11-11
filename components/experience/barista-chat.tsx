"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createBarista,
  type BaristaChip,
  type BaristaState,
} from "../../lib/experience/barista";
import type {
  BaristaAction,
  BaristaData,
} from "../../lib/experience/barista-tools";
import { parseLabSearch, type LabState } from "../../lib/experience/lab-link";
import { brewParamsSchema } from "../../lib/experience/journal";
import { STORAGE, readLocal } from "../../lib/experience/storage";
import { trackExperience } from "../../lib/experience/analytics";
import { formatReply } from "../../lib/experience/reply-format";
import { useCoffeeContext } from "./coffee-context";

type Mode = "checking" | "ai" | "guided";
type Message = {
  id: number;
  from: "user" | "barista";
  text: string;
  actions?: BaristaAction[];
  chips?: BaristaChip[];
  pending?: boolean;
  error?: "unavailable" | "limited" | "cancelled";
  ai?: boolean;
};
const PROBLEMS = [
  "amargo",
  "azedo",
  "fraco",
  "forte",
  "equilibrado",
  "nao-sei",
] as const;
type Problem = (typeof PROBLEMS)[number];
const problemQuestion: Record<Problem, string> = {
  amargo: "Por que meu café ficou amargo?",
  azedo: "Por que meu café ficou azedo?",
  fraco: "Por que meu café ficou fraco?",
  forte: "Meu café ficou forte demais. O que mudo?",
  equilibrado: "Meu café ficou equilibrado. Como explorar outro perfil?",
  "nao-sei": "Não consegui identificar o que achei do meu café.",
};
const AI_STARTERS = [
  "Tenho SALSA, V60 e 250 ml de água. Quanto café uso?",
  "Qual a diferença entre o SAMBA e o SALSA?",
  "Meu café ficou amargo. O que faço?",
  "O que significa TDS?",
];
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const HISTORY_KEY = "cura-experience-barista";

function renderInline(text: string) {
  return formatReply(text).map((segment, index) =>
    segment.bold ? <strong key={index}>{segment.text}</strong> : segment.text,
  );
}

function sessionId() {
  try {
    const existing = sessionStorage.getItem("cura-experience-barista-session");
    if (existing) return existing;
    const created = Array.from(
      crypto.getRandomValues(new Uint8Array(16)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    sessionStorage.setItem("cura-experience-barista-session", created);
    return created;
  } catch {
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
  }
}

/**
 * Barista Cura chat, hybrid: AI when the server says it is available, the
 * guided mode otherwise (or when the person prefers it). The guided mode is
 * always labelled as such; nothing simulated is presented as AI. Messages
 * stay in this tab only.
 */
export function BaristaChat({ data }: { data: BaristaData }) {
  const barista = useMemo(() => createBarista(data), [data]);
  const { coffeeSlug, setCoffee, ready } = useCoffeeContext();
  const [mode, setMode] = useState<Mode>("checking");
  const [messages, setMessages] = useState<Message[]>([]);
  const [guided, setGuided] = useState<BaristaState>({
    flow: { kind: "idle" },
    session: {},
  });
  const [problem, setProblem] = useState<Problem | undefined>();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const abort = useRef<AbortController | null>(null);
  const started = useRef(false);

  // Context: the coffee in use, the recipe from the Lab link or the last one.
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const known = {
      coffees: data.coffees.map((c) => c.slug),
      methods: data.methods.map((m) => m.id),
    };
    const fromUrl = parseLabSearch(window.location.search, known);
    const saved = brewParamsSchema.safeParse(
      readLocal<unknown>(STORAGE.brew, null),
    );
    if (fromUrl.coffeeSlug) setCoffee(fromUrl.coffeeSlug);
    const lab: LabState | undefined =
      fromUrl.methodId && fromUrl.mode && fromUrl.amount
        ? (fromUrl as LabState)
        : saved.success
          ? saved.data
          : undefined;
    const reported = new URLSearchParams(window.location.search).get(
      "problema",
    );
    const currentProblem = (PROBLEMS as readonly string[]).includes(
      reported ?? "",
    )
      ? (reported as Problem)
      : undefined;
    setProblem(currentProblem);
    const session = {
      coffeeSlug: fromUrl.coffeeSlug ?? coffeeSlug ?? undefined,
      methodId: lab?.methodId,
      lab,
    };
    setGuided({ flow: { kind: "idle" }, session });
    let restored: Message[] = [];
    try {
      restored = JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? "[]");
      if (!Array.isArray(restored)) restored = [];
    } catch {
      restored = [];
    }
    if (restored.length && !currentProblem) {
      nextId.current = Math.max(...restored.map((m) => m.id)) + 1;
      setMessages(restored.filter((m) => !m.pending));
    } else {
      const greeting = barista.greeting(session);
      setMessages([
        {
          id: 0,
          from: "barista",
          text: greeting.text.join("\n\n"),
          chips: greeting.chips,
        },
      ]);
    }
    if (currentProblem) setDraft(problemQuestion[currentProblem]);
    if (process.env.NEXT_PUBLIC_BARISTA_API !== "available") {
      setMode("guided");
      return;
    }
    fetch(`${base}/api/barista`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((status) => setMode(status?.enabled ? "ai" : "guided"))
      .catch(() => setMode("guided"));
  }, [ready, data, barista, coffeeSlug, setCoffee]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(messages.filter((m) => !m.pending).slice(-30)),
      );
    } catch {
      /* not kept */
    }
    const list = log.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  const push = (message: Omit<Message, "id">) => {
    const id = nextId.current++;
    setMessages((current) => [...current, { ...message, id }]);
    return id;
  };
  const patch = (
    id: number,
    update: Partial<Message> | ((m: Message) => Partial<Message>),
  ) =>
    setMessages((current) =>
      current.map((m) =>
        m.id === id
          ? { ...m, ...(typeof update === "function" ? update(m) : update) }
          : m,
      ),
    );

  function sendGuided(value: { text?: string; value?: string }, label: string) {
    push({ from: "user", text: label });
    const reply = barista.respond(guided, value);
    setGuided({ flow: reply.flow, session: reply.session });
    if (reply.session.coffeeSlug && reply.session.coffeeSlug !== coffeeSlug)
      setCoffee(reply.session.coffeeSlug);
    push({
      from: "barista",
      text: reply.text.join("\n\n"),
      chips: reply.chips,
      actions: reply.actions,
    });
  }

  async function sendAi(text: string) {
    const history = messages
      .filter((m) => !m.pending && !m.error && (m.from === "user" || m.ai))
      .map((m) => ({
        role: m.from === "user" ? ("user" as const) : ("assistant" as const),
        content: m.text.slice(0, 2000),
      }))
      .slice(-11);
    push({ from: "user", text });
    const pending = push({
      from: "barista",
      text: "",
      pending: true,
      ai: true,
    });
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    const lab = guided.session.lab;
    try {
      const response = await fetch(`${base}/api/barista`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-cura-barista": "1" },
        body: JSON.stringify({
          sessionId: sessionId(),
          messages: [...history, { role: "user", content: text }],
          context: {
            ...(coffeeSlug ? { coffeeSlug } : {}),
            ...(lab
              ? {
                  methodId: lab.methodId,
                  lab: { ...lab, coffeeSlug: undefined },
                }
              : {}),
            ...(problem ? { lastProblem: problem } : {}),
          },
        }),
        signal: controller.signal,
      });
      if (response.status === 429) {
        patch(pending, {
          pending: false,
          error: "limited",
          text: "Muitas perguntas em pouco tempo, ou o limite de hoje foi atingido. Tente de novo mais tarde ou continue no modo guiado.",
        });
        return;
      }
      if (!response.ok || !response.body) {
        patch(pending, {
          pending: false,
          error: "unavailable",
          text: "O Barista com IA está indisponível agora. Você pode continuar no modo guiado.",
        });
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotText = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let event: {
            type: string;
            delta?: string;
            actions?: BaristaAction[];
            message?: string;
            code?: string;
          };
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }
          if (event.type === "text" && event.delta) {
            gotText = true;
            patch(pending, (m) => ({ text: m.text + event.delta }));
          } else if (event.type === "actions" && event.actions) {
            const safe = event.actions.filter(
              (a) =>
                typeof a.href === "string" &&
                /^\/(experiencia|comparar|cafes)\//.test(a.href),
            );
            patch(pending, { actions: safe });
          } else if (event.type === "error") {
            patch(pending, {
              error: event.code === "cancelled" ? "cancelled" : "unavailable",
              text: event.message ?? "Erro.",
            });
          }
        }
      }
      patch(pending, (m) => ({
        pending: false,
        text:
          m.text ||
          (gotText ? m.text : "Não recebi uma resposta. Tente de novo."),
      }));
    } catch {
      patch(
        pending,
        controller.signal.aborted
          ? { pending: false, error: "cancelled", text: "Resposta cancelada." }
          : {
              pending: false,
              error: "unavailable",
              text: "Não consegui falar com o Barista com IA. Você pode continuar no modo guiado.",
            },
      );
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  function send(value: { text?: string; value?: string }, label: string) {
    if (busy) return;
    trackExperience("barista_message", {
      kind: value.value ? value.value.split(":")[0] : "texto",
      mode: mode === "ai" && !value.value ? "ia" : "guiado",
    });
    // Chips are guided-mode affordances; free text goes to the AI when on.
    if (mode === "ai" && value.text && !value.value) void sendAi(value.text);
    else sendGuided(value, label);
  }

  const last = [...messages]
    .reverse()
    .find((m) => m.from === "barista" && !m.pending);
  const chips =
    mode === "ai" && messages.length <= 1
      ? AI_STARTERS.map((q) => ({ label: q, value: `ask:${q}` }))
      : (last?.chips ?? []);
  return (
    <div className="xp-chat-wrap">
      <div className={`xp-mode ${mode === "ai" ? "is-ai" : ""}`} role="status">
        {mode === "checking" ? (
          <span className="mono">Verificando o Barista…</span>
        ) : mode === "ai" ? (
          <>
            <span className="mono">BARISTA COM IA</span>
            <span>
              Respostas geradas por inteligência artificial, com receitas
              calculadas pelo Laboratório.
            </span>
            <button
              type="button"
              className="xp-text-link"
              onClick={() => setMode("guided")}
            >
              Usar o modo guiado
            </button>
          </>
        ) : (
          <>
            <span className="mono">MODO GUIADO · SEM IA</span>
            <span>
              Respostas a partir de regras e da base revisada da Cura.
            </span>
          </>
        )}
      </div>
      <div className="xp-chat">
        <ol
          className="xp-chat-log"
          ref={log}
          aria-live="polite"
          aria-label="Conversa com o Barista Cura"
        >
          {messages.map((message) =>
            message.from === "user" ? (
              <li key={message.id} className="xp-msg is-user">
                <span className="xp-visually-hidden">Você: </span>
                {message.text}
              </li>
            ) : (
              <li
                key={message.id}
                className={`xp-msg is-barista ${message.error ? "is-error" : ""}`}
                aria-busy={message.pending || undefined}
              >
                <span className="xp-msg-author mono" aria-hidden="true">
                  BARISTA CURA{message.ai ? " · IA" : ""}
                </span>
                <span className="xp-visually-hidden">Barista Cura: </span>
                {message.pending && !message.text ? (
                  <span className="xp-typing" aria-label="Escrevendo">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  message.text
                    .split(/\n{2,}/)
                    .map((paragraph, index) => (
                      <p key={index}>{renderInline(paragraph)}</p>
                    ))
                )}
                {message.actions && message.actions.length > 0 && (
                  <div className="xp-msg-actions">
                    {message.actions.map((action) => (
                      <Link
                        key={action.href}
                        href={action.href}
                        className={
                          action.kind === "lab" ? "button" : "xp-button-ghost"
                        }
                        onClick={() =>
                          trackExperience("content_view", {
                            content: `barista-acao-${action.kind}`,
                          })
                        }
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                )}
                {(message.error === "unavailable" ||
                  message.error === "limited") &&
                  mode === "ai" && (
                    <button
                      type="button"
                      className="xp-button-ghost"
                      onClick={() => setMode("guided")}
                    >
                      Continuar no modo guiado
                    </button>
                  )}
              </li>
            ),
          )}
        </ol>
        {chips.length > 0 && !busy && (
          <div className="xp-chat-chips" role="group" aria-label="Sugestões">
            {chips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() =>
                  chip.value.startsWith("ask:")
                    ? send({ text: chip.value.slice(4) }, chip.value.slice(4))
                    : send({ value: chip.value }, chip.label)
                }
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}
        <form
          className="xp-chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            setDraft("");
            send({ text }, text);
          }}
        >
          <label htmlFor="barista-input" className="xp-visually-hidden">
            Escreva sua pergunta
          </label>
          <input
            id="barista-input"
            ref={input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() =>
              setTimeout(
                () => input.current?.scrollIntoView({ block: "nearest" }),
                300,
              )
            }
            placeholder="Ex.: tenho SALSA e V60, 250 ml"
            autoComplete="off"
            enterKeyHint="send"
            maxLength={500}
            disabled={mode === "checking"}
          />
          {busy ? (
            <button
              type="button"
              className="xp-button-ghost"
              onClick={() => abort.current?.abort()}
            >
              Parar
            </button>
          ) : (
            <button
              type="submit"
              className="button"
              disabled={!draft.trim() || mode === "checking"}
            >
              Enviar
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
