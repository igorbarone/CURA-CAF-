"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createBarista,
  type BaristaContext,
  type BaristaFlow,
  type BaristaReply,
} from "../../lib/experience/barista";
import { trackExperience } from "../../lib/experience/analytics";

type Message =
  | { id: number; from: "user"; text: string }
  | { id: number; from: "barista"; reply: BaristaReply };

/**
 * Barista Cura chat. Messages live only in this component's memory: nothing
 * is stored or sent anywhere. Analytics records that a message happened and
 * which chip/flow was used, never the typed text.
 */
export function BaristaChat({ context }: { context: BaristaContext }) {
  const barista = useMemo(() => createBarista(context), [context]);
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 0, from: "barista", reply: barista.greeting() },
  ]);
  const [flow, setFlow] = useState<BaristaFlow>({ kind: "idle" });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLOListElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    const list = log.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  async function send(input: { text?: string; value?: string }, label: string) {
    if (busy) return;
    setBusy(true);
    setMessages((current) => [
      ...current,
      { id: nextId.current++, from: "user", text: label },
    ]);
    trackExperience("barista_message", {
      kind: input.value ? input.value.split(":")[0] : "texto",
      flow: input.value?.startsWith("flow:") ? input.value.slice(5) : flow.kind,
    });
    try {
      const reply = await barista.provider.reply(flow, input);
      setFlow(reply.flow);
      setMessages((current) => [
        ...current,
        { id: nextId.current++, from: "barista", reply },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: nextId.current++,
          from: "barista",
          reply: {
            text: ["Tive um problema para responder agora. Tente de novo."],
            chips: [],
            flow,
          },
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const last = [...messages]
    .reverse()
    .find((message) => message.from === "barista");
  const chips = last && last.from === "barista" ? last.reply.chips : [];
  return (
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
            <li key={message.id} className="xp-msg is-barista">
              <span className="xp-msg-author mono" aria-hidden="true">
                BARISTA CURA
              </span>
              <span className="xp-visually-hidden">Barista Cura: </span>
              {message.reply.text.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {message.reply.link && (
                <Link className="xp-text-link" href={message.reply.link.href}>
                  {message.reply.link.label}
                </Link>
              )}
            </li>
          ),
        )}
      </ol>
      {chips.length > 0 && (
        <div
          className="xp-chat-chips"
          role="group"
          aria-label="Sugestões de resposta"
        >
          {chips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              disabled={busy}
              onClick={() => send({ value: chip.value }, chip.label)}
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
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ex.: meu café está amargo"
          autoComplete="off"
          maxLength={300}
        />
        <button
          type="submit"
          className="button"
          disabled={busy || !draft.trim()}
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
