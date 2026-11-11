"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Arrow } from "../arrow";
import { labHref } from "../../lib/experience/lab-link";
import {
  emptyJournal,
  journalStats,
  loadJournal,
  removeEntry,
  removeFavorite,
  saveJournal,
  suggestNextCoffee,
  type Journal,
} from "../../lib/experience/journal";
import type { ExperienceCoffee } from "../../lib/experience/coffee";
import type { BrewMethod, Diagnosis, Taste } from "../../lib/experience/schema";

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
const dateFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Favourites, brew history and plain counts, kept only in this browser. */
export function JourneyView({
  coffees,
  methods,
  diagnosis,
  taste,
}: {
  coffees: ExperienceCoffee[];
  methods: BrewMethod[];
  diagnosis: Diagnosis;
  taste: Taste;
}) {
  const [journal, setJournal] = useState<Journal | null>(null);
  const [available, setAvailable] = useState(true);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const store = storage();
    setAvailable(!!store && saveJournal(store, loadJournal(store)));
    setJournal(loadJournal(store));
  }, []);
  if (!journal) return <p className="xp-loading mono">Carregando…</p>;
  const update = (next: Journal) => {
    setJournal(next);
    saveJournal(storage(), next);
  };
  const stats = journalStats(journal, coffees, methods);
  const suggestion = suggestNextCoffee(journal, coffees, taste);
  const label = (id?: string) =>
    diagnosis.options.find((option) => option.id === id)?.label;
  const coffeeName = (slug?: string) =>
    coffees.find((coffee) => coffee.slug === slug)?.name;
  return (
    <div className="xp-journey-view">
      {!available && (
        <p className="xp-warning" role="note">
          Este navegador não está guardando dados (navegação privada ou
          armazenamento bloqueado). O que você registrar pode se perder ao
          fechar a página.
        </p>
      )}
      <p className="xp-small">
        Tudo aqui fica só neste navegador: sem cadastro e sem sincronização com
        outros aparelhos.
      </p>

      <section className="xp-section" aria-labelledby="fav-title">
        <h2 id="fav-title">
          Receitas <em>salvas.</em>
        </h2>
        {journal.favorites.length ? (
          <ul className="xp-card-list">
            {journal.favorites.map((favorite) => (
              <li key={favorite.id} className="xp-journal-card">
                <p className="mono xp-journal-meta">
                  {dateFormat.format(new Date(favorite.savedAt))}
                </p>
                <h3>{favorite.name}</h3>
                <p>{favorite.summary}</p>
                <div className="xp-hero-actions">
                  <Link
                    className="button"
                    href={labHref({
                      ...favorite.params,
                      coffeeSlug: favorite.coffeeSlug,
                    })}
                  >
                    Preparar de novo <Arrow />
                  </Link>
                  <button
                    type="button"
                    className="xp-text-link"
                    onClick={() => update(removeFavorite(journal, favorite.id))}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="xp-empty">
            Nenhuma receita salva ainda. No{" "}
            <Link className="xp-text-link" href="/experiencia/preparar/">
              Laboratório
            </Link>
            , toque em “Salvar receita” para guardar a sua.
          </p>
        )}
      </section>

      <section className="xp-section" aria-labelledby="hist-title">
        <h2 id="hist-title">
          Diário <em>de preparo.</em>
        </h2>
        {journal.entries.length ? (
          <>
            <dl className="xp-stats">
              <div>
                <dt>Preparos registrados</dt>
                <dd className="mono">{stats.brews}</dd>
              </div>
              <div>
                <dt>Avaliados como equilibrados</dt>
                <dd className="mono">
                  {stats.balanced} de {stats.rated}
                </dd>
              </div>
              <div>
                <dt>Métodos que você mais usa</dt>
                <dd>
                  {stats.methodsUsed
                    .slice(0, 3)
                    .map((item) => `${item.name} (${item.total})`)
                    .join(", ")}
                </dd>
              </div>
              <div>
                <dt>Cafés que você registrou</dt>
                <dd>
                  {stats.coffeesTried
                    .map((item) => `${item.name} (${item.total})`)
                    .join(", ") || "Nenhum café informado"}
                </dd>
              </div>
            </dl>
            {stats.recentOutcomes.length > 1 && (
              <div className="xp-outcomes">
                <p className="eyebrow">
                  COMO FICARAM OS ÚLTIMOS PREPAROS (DO MAIS ANTIGO AO MAIS
                  RECENTE)
                </p>
                <ol>
                  {stats.recentOutcomes.map((item) => (
                    <li
                      key={item.id}
                      className={
                        item.outcome === "equilibrado" ? "is-good" : ""
                      }
                    >
                      {label(item.outcome)}
                    </li>
                  ))}
                </ol>
                <p className="xp-small">
                  É o registro do que você marcou, não uma medida do seu
                  paladar.
                </p>
              </div>
            )}
            <ul className="xp-card-list">
              {journal.entries.slice(0, 20).map((entry) => (
                <li key={entry.id} className="xp-journal-card">
                  <p className="mono xp-journal-meta">
                    {dateFormat.format(new Date(entry.at))}
                    {coffeeName(entry.coffeeSlug)
                      ? ` · ${coffeeName(entry.coffeeSlug)}`
                      : ""}
                    {entry.previousId ? " · nova tentativa" : ""}
                  </p>
                  <p>{entry.summary}</p>
                  <p className="xp-small">
                    {entry.outcome
                      ? `Resultado: ${label(entry.outcome)}.`
                      : "Sem avaliação."}
                    {entry.adjustment
                      ? ` Ajuste sugerido: ${entry.adjustment.text}`
                      : ""}
                  </p>
                  <div className="xp-hero-actions">
                    <Link
                      className="xp-text-link"
                      href={labHref({
                        ...entry.params,
                        coffeeSlug: entry.coffeeSlug,
                      })}
                    >
                      Repetir esta receita
                    </Link>
                    <button
                      type="button"
                      className="xp-text-link"
                      onClick={() => update(removeEntry(journal, entry.id))}
                    >
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="xp-empty">
            Seu diário está vazio. Ao terminar um preparo no Laboratório, ele
            aparece aqui com o resultado que você marcar.
          </p>
        )}
      </section>

      {suggestion && (
        <section
          className="xp-section xp-next-coffee"
          aria-labelledby="next-title"
        >
          <p className="eyebrow">PARA A PRÓXIMA XÍCARA</p>
          <h2 id="next-title">
            Que tal o <em>{suggestion.coffee.name}?</em>
          </h2>
          <p>{suggestion.reason}</p>
          <Link
            className="xp-text-link"
            href={`/experiencia/cafes/${suggestion.coffee.slug}/`}
          >
            Conhecer o {suggestion.coffee.name} <Arrow />
          </Link>
        </section>
      )}

      {(journal.entries.length > 0 || journal.favorites.length > 0) && (
        <section className="xp-section" aria-label="Apagar dados">
          {confirming ? (
            <p>
              Apagar todas as receitas e o diário deste navegador?{" "}
              <button
                type="button"
                className="xp-button-ghost"
                onClick={() => {
                  update(emptyJournal());
                  setConfirming(false);
                }}
              >
                Sim, apagar
              </button>{" "}
              <button
                type="button"
                className="xp-text-link"
                onClick={() => setConfirming(false)}
              >
                Cancelar
              </button>
            </p>
          ) : (
            <button
              type="button"
              className="xp-text-link"
              onClick={() => setConfirming(true)}
            >
              Apagar meus dados deste navegador
            </button>
          )}
        </section>
      )}
    </div>
  );
}
