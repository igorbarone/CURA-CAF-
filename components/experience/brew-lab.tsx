"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Arrow } from "../arrow";
import { BrewTimer } from "./brew-timer";
import { BrewDiagnosis } from "./brew-diagnosis";
import { RatioCalculator } from "./ratio-calculator";
import { useCoffeeContext } from "./coffee-context";
import {
  applyAdjustment,
  formatClock,
  formatNumber,
  formatRatio,
  generateRecipe,
  methodFit,
  parseAmount,
  summarizeRecipe,
  type BrewParams,
} from "../../lib/experience/brew";
import { labSearch, parseLabSearch } from "../../lib/experience/lab-link";
import { trackExperience } from "../../lib/experience/analytics";
import { STORAGE, readLocal, writeLocal } from "../../lib/experience/storage";
import {
  addEntry,
  addFavorite,
  brewParamsSchema,
  loadJournal,
  rateEntry,
  saveJournal,
  suggestNextCoffee,
  type BrewEntry,
  type Journal,
} from "../../lib/experience/journal";
import type { ExperienceCoffee } from "../../lib/experience/coffee";
import type {
  Adjustment,
  BrewMethod,
  Diagnosis,
  InputMode,
  Strength,
  Taste,
} from "../../lib/experience/schema";

type Level = "iniciante" | "avancado";
const strengthCopy: Record<Strength, string> = {
  suave: "Mais suave",
  equilibrado: "Equilibrada",
  intenso: "Mais intensa",
};
const modeCopy: Record<InputMode, string> = {
  cups: "Por porções",
  coffee: "Pelo café",
  water: "Pela água",
  size: "Tamanho da moka",
};
const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

function defaultAmount(method: BrewMethod, mode: InputMode) {
  if (mode === "size") return method.moka?.defaultSize ?? 3;
  if (mode === "cups")
    return method.kind === "espresso" || method.id === "aeropress" ? 1 : 2;
  if (mode === "coffee")
    return method.kind === "cold" ? 50 : method.id === "aeropress" ? 15 : 20;
  return method.id === "aeropress" ? 200 : 300;
}
function amountStep(mode: InputMode) {
  return mode === "water" ? 25 : 1;
}

export function BrewLab({
  methods,
  coffees,
  diagnosis,
  taste,
}: {
  methods: BrewMethod[];
  coffees: ExperienceCoffee[];
  diagnosis: Diagnosis;
  taste: Taste;
}) {
  const { coffeeSlug, setCoffee, ready } = useCoffeeContext();
  const [methodId, setMethodId] = useState("");
  const [mode, setMode] = useState<InputMode>("cups");
  const [amountText, setAmountText] = useState("2");
  const [strength, setStrength] = useState<Strength>("equilibrado");
  const [ratio, setRatio] = useState<number | undefined>();
  const [dose, setDose] = useState<number | undefined>();
  const [level, setLevel] = useState<Level>("iniciante");
  const [activeStep, setActiveStep] = useState(-1);
  const [finished, setFinished] = useState(false);
  const [journal, setJournal] = useState<Journal | null>(null);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [previousId, setPreviousId] = useState<string | undefined>();
  const [adjustNotes, setAdjustNotes] = useState<string[]>([]);
  const [rated, setRated] = useState<BrewEntry["outcome"]>();
  const [saved, setSaved] = useState("");
  const recipeHeading = useRef<HTMLHeadingElement>(null);
  const tutorialHeading = useRef<HTMLHeadingElement>(null);
  const diagnosisRef = useRef<HTMLElement>(null);
  const initialised = useRef(false);

  // URL (QR, Barista, favourites, coffee pages) wins over the last recipe.
  useEffect(() => {
    if (!ready || initialised.current) return;
    initialised.current = true;
    setJournal(loadJournal(storage()));
    const known = {
      coffees: coffees.map((c) => c.slug),
      methods: methods.map((m) => m.id),
    };
    const fromUrl = parseLabSearch(window.location.search, known);
    const saved = brewParamsSchema.safeParse(
      readLocal<unknown>(STORAGE.brew, null),
    );
    const state: Partial<BrewParams> = fromUrl.methodId
      ? fromUrl
      : saved.success
        ? saved.data
        : {};
    if (fromUrl.coffeeSlug) setCoffee(fromUrl.coffeeSlug);
    const method = methods.find((item) => item.id === state.methodId);
    if (method) {
      setMethodId(method.id);
      const nextMode =
        state.mode && method.modes.includes(state.mode)
          ? state.mode
          : method.modes[0];
      setMode(nextMode);
      setAmountText(
        formatNumber(state.amount ?? defaultAmount(method, nextMode)),
      );
      if (state.strength) setStrength(state.strength);
      if (state.ratio) setRatio(state.ratio);
      if (state.dose) setDose(state.dose);
    }
    setLevel(readLocal<Level>(STORAGE.level, "iniciante"));
  }, [ready, coffees, methods, setCoffee]);

  const method = methods.find((item) => item.id === methodId);
  const coffee = coffees.find((item) => item.slug === coffeeSlug);
  const amount = parseAmount(amountText);
  const params: BrewParams | null = method
    ? {
        methodId: method.id,
        mode,
        amount,
        strength,
        ...(ratio ? { ratio } : {}),
        ...(dose ? { dose } : {}),
      }
    : null;
  const paramsKey = JSON.stringify(params);
  const recipe = useMemo(
    () => (method && params ? generateRecipe(method, params) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [method, paramsKey],
  );

  // Keep the URL and the last recipe in sync, so the recipe can be resumed.
  useEffect(() => {
    if (!initialised.current || !recipe?.ok) return;
    writeLocal(STORAGE.brew, recipe.params);
    const search = labSearch({
      ...recipe.params,
      coffeeSlug: coffeeSlug || undefined,
    });
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${search}`,
    );
  }, [recipe, coffeeSlug]);
  useEffect(() => {
    if (method)
      trackExperience("recipe_generate", { method: method.id, strength });
  }, [method, strength]);

  const persist = (next: Journal) => {
    setJournal(next);
    return saveJournal(storage(), next);
  };
  const chooseMethod = (item: BrewMethod) => {
    setMethodId(item.id);
    const nextMode = item.modes.includes(mode) ? mode : item.modes[0];
    setMode(nextMode);
    if (!item.modes.includes(mode) || item.id !== methodId)
      setAmountText(formatNumber(defaultAmount(item, nextMode)));
    setRatio(undefined);
    setDose(undefined);
    setAdjustNotes([]);
    setFinished(false);
    setEntryId(null);
    setRated(undefined);
    trackExperience("method_select", {
      method: item.id,
      coffee: coffeeSlug || undefined,
    });
    requestAnimationFrame(() =>
      recipeHeading.current?.focus({ preventScroll: true }),
    );
  };
  const scrollTo = (element: HTMLElement | null) =>
    element?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  const finish = useCallback(() => {
    setFinished(true);
    if (method && recipe?.ok && journal) {
      const result = addEntry(journal, {
        coffeeSlug: coffeeSlug || undefined,
        params: recipe.params,
        summary: summarizeRecipe(method, recipe),
        previousId,
      });
      persist(result.journal);
      setEntryId(result.entry.id);
    }
    requestAnimationFrame(() => scrollTo(diagnosisRef.current));
  }, [method, recipe, journal, coffeeSlug, previousId]);

  const retry = (adjustment: Adjustment, text: string) => {
    if (!method || !params) return;
    const next = applyAdjustment(method, params, adjustment);
    if (journal && entryId)
      persist(
        rateEntry(journal, entryId, {
          outcome: rated,
          adjustment: { text, notes: next.notes },
        }),
      );
    setRatio(next.params.ratio);
    setAdjustNotes(next.notes);
    setPreviousId(entryId ?? undefined);
    setEntryId(null);
    setFinished(false);
    setRated(undefined);
    trackExperience("recipe_generate", { method: method.id, via: "ajuste" });
    requestAnimationFrame(() => {
      scrollTo(recipeHeading.current);
      recipeHeading.current?.focus({ preventScroll: true });
    });
  };
  const fit = method ? methodFit(method, coffee) : "unknown";
  const suggestion =
    rated === "equilibrado" && journal
      ? suggestNextCoffee(journal, coffees, taste)
      : null;
  const baristaHref = (problem: string) =>
    recipe?.ok
      ? `/experiencia/barista/?${labSearch({ ...recipe.params, coffeeSlug: coffeeSlug || undefined })}&problema=${problem}`
      : "/experiencia/barista/";

  return (
    <div className="xp-lab">
      <section className="xp-lab-panel" aria-labelledby="lab-setup">
        <h2 id="lab-setup" className="xp-visually-hidden">
          Monte sua receita
        </h2>
        <fieldset className="xp-lab-step">
          <legend>
            <span className="mono">1</span> Qual café você vai usar?
          </legend>
          <div className="xp-chip-row">
            {coffees.map((item) => (
              <label key={item.slug} className="xp-chip-option">
                <input
                  type="radio"
                  name="cafe"
                  checked={coffeeSlug === item.slug}
                  onChange={() => {
                    setCoffee(item.slug);
                    trackExperience("coffee_select", {
                      coffee: item.slug,
                      context: "laboratorio",
                    });
                  }}
                />
                <span>{item.name}</span>
              </label>
            ))}
            <label className="xp-chip-option">
              <input
                type="radio"
                name="cafe"
                checked={coffeeSlug === ""}
                onChange={() => setCoffee("")}
              />
              <span>Outro café</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="xp-lab-step">
          <legend>
            <span className="mono">2</span> Qual equipamento você tem?
          </legend>
          <div className="xp-method-grid">
            {methods.map((item) => (
              <label
                key={item.id}
                className={`xp-method-card ${methodId === item.id ? "is-selected" : ""}`}
              >
                <input
                  type="radio"
                  name="metodo"
                  checked={methodId === item.id}
                  onChange={() => chooseMethod(item)}
                />
                <span className="xp-method-name">{item.name}</span>
                <span className="xp-method-summary">{item.summary}</span>
                {methodFit(item, coffee) === "label" && (
                  <span className="xp-badge mono">Sugerido no rótulo</span>
                )}
              </label>
            ))}
          </div>
        </fieldset>

        {method && (
          <>
            <fieldset className="xp-lab-step">
              <legend>
                <span className="mono">3</span>{" "}
                {method.kind === "espresso"
                  ? "Quantos espressos?"
                  : method.kind === "moka"
                    ? "Qual o tamanho da sua moka?"
                    : "Quanto você quer preparar?"}
              </legend>
              {method.kind === "moka" && method.moka ? (
                <div
                  className="xp-chip-row"
                  role="radiogroup"
                  aria-label="Tamanho da moka em xícaras"
                >
                  {method.moka.sizes.map((size) => (
                    <label key={size} className="xp-chip-option">
                      <input
                        type="radio"
                        name="moka"
                        checked={amount === size}
                        onChange={() => setAmountText(String(size))}
                      />
                      <span>
                        {size} {size === 1 ? "xícara" : "xícaras"}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <>
                  {method.modes.length > 1 && (
                    <div
                      className="xp-segmented"
                      role="group"
                      aria-label="Calcular a partir de"
                    >
                      {method.modes.map((item) => (
                        <button
                          key={item}
                          type="button"
                          aria-pressed={mode === item}
                          onClick={() => {
                            setMode(item);
                            setAmountText(
                              formatNumber(defaultAmount(method, item)),
                            );
                          }}
                        >
                          {modeCopy[item]}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="xp-stepper">
                    <button
                      type="button"
                      aria-label="Diminuir"
                      onClick={() =>
                        setAmountText(
                          formatNumber(
                            Math.max(
                              amountStep(mode),
                              (amount || 0) - amountStep(mode),
                            ),
                          ),
                        )
                      }
                    >
                      −
                    </button>
                    <label>
                      <span>
                        {mode === "cups"
                          ? method.kind === "espresso"
                            ? "Espressos"
                            : "Porções"
                          : mode === "coffee"
                            ? "Café que tenho (g)"
                            : "Água que tenho (g ou ml)"}
                      </span>
                      <input
                        inputMode="decimal"
                        value={amountText}
                        onChange={(event) => setAmountText(event.target.value)}
                        aria-describedby="amount-help"
                        aria-invalid={!recipe?.ok}
                      />
                    </label>
                    <button
                      type="button"
                      aria-label="Aumentar"
                      onClick={() =>
                        setAmountText(
                          formatNumber(
                            (Number.isFinite(amount) ? amount : 0) +
                              amountStep(mode),
                          ),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                  <p id="amount-help" className="xp-small">
                    {mode === "cups"
                      ? method.kind === "espresso"
                        ? "Cada espresso é uma extração separada, com uma dose no cesto."
                        : `Uma porção = ${method.cup.label}.`
                      : mode === "water"
                        ? "Água de preparo. Parte dela fica no pó, então a xícara recebe um pouco menos."
                        : "Informe o café que você tem; calculamos a água."}
                  </p>
                </>
              )}
            </fieldset>

            {method.kind !== "moka" && (
              <fieldset className="xp-lab-step">
                <legend>
                  <span className="mono">4</span> Como você prefere a bebida?
                </legend>
                <div
                  className="xp-segmented"
                  role="group"
                  aria-label="Intensidade da bebida"
                >
                  {(Object.keys(strengthCopy) as Strength[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={strength === item && !ratio}
                      onClick={() => {
                        setStrength(item);
                        setRatio(undefined);
                        setAdjustNotes([]);
                      }}
                    >
                      {strengthCopy[item]}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </>
        )}
      </section>

      {!method && (
        <p className="xp-empty">
          Escolha um equipamento para ver sua receita, o passo a passo e o
          cronômetro.
        </p>
      )}

      {method && recipe && (
        <section className="xp-recipe" aria-labelledby="recipe-title">
          <div className="xp-recipe-head">
            <div>
              <p className="eyebrow">
                SUA RECEITA{coffee ? ` · ${coffee.name}` : ""}
              </p>
              <h2 id="recipe-title" ref={recipeHeading} tabIndex={-1}>
                {method.name}
                {method.kind !== "moka" && (
                  <>
                    ,{" "}
                    <em>
                      {ratio
                        ? `proporção ${formatRatio(ratio)}`
                        : strengthCopy[strength].toLocaleLowerCase("pt-BR")}
                      .
                    </em>
                  </>
                )}
              </h2>
            </div>
            <div
              className="xp-segmented is-small"
              role="group"
              aria-label="Nível de detalhe"
            >
              {(["iniciante", "avancado"] as Level[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={level === item}
                  onClick={() => {
                    setLevel(item);
                    writeLocal(STORAGE.level, item);
                  }}
                >
                  {item === "iniciante" ? "Iniciante" : "Avançado"}
                </button>
              ))}
            </div>
          </div>
          {adjustNotes.length > 0 && (
            <div className="xp-callout xp-adjusted" role="status">
              <strong>Nova tentativa com ajuste:</strong>{" "}
              {adjustNotes.join(" ")} Mude só isso e prove de novo.
            </div>
          )}
          {coffee && fit === "experiment" && (
            <p className="xp-callout">
              {method.name} não está entre os preparos sugeridos no rótulo do{" "}
              {coffee.name} (
              {coffee.preparations.join(" e ").toLocaleLowerCase("pt-BR")}).
              Funciona como experimento: aproveite para descobrir outro lado do
              café.
            </p>
          )}
          {recipe.ok ? (
            <>
              {recipe.rounds > 1 && (
                <p className="xp-rounds" role="note">
                  <strong>
                    {recipe.rounds}{" "}
                    {recipe.roundLabel === "extração" ? "extrações" : "rodadas"}
                  </strong>{" "}
                  de {formatNumber(recipe.perRound.coffeeGrams)} g de café e{" "}
                  {formatNumber(recipe.perRound.waterGrams)} g de{" "}
                  {recipe.ratioMeaning === "beverage" ? "bebida" : "água"} cada.
                  Os números abaixo valem para cada {recipe.roundLabel}.
                </p>
              )}
              <dl className="xp-recipe-grid">
                <div>
                  <dt>
                    Café{recipe.rounds > 1 ? ` por ${recipe.roundLabel}` : ""}
                  </dt>
                  <dd>
                    <span className="xp-big">
                      {formatNumber(recipe.perRound.coffeeGrams)}
                    </span>{" "}
                    g
                    {recipe.approximate && recipe.rounds === 1 && (
                      <span className="xp-approx mono">
                        {" "}
                        ≈ (exato {formatNumber(recipe.coffeeExact)} g)
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>
                    {recipe.ratioMeaning === "beverage"
                      ? "Bebida na xícara"
                      : method.kind === "cold"
                        ? "Água de infusão"
                        : "Água de preparo"}
                    {recipe.rounds > 1 ? ` por ${recipe.roundLabel}` : ""}
                  </dt>
                  <dd>
                    <span className="xp-big">
                      {formatNumber(recipe.perRound.waterGrams)}
                    </span>{" "}
                    {recipe.ratioMeaning === "beverage" ? "g" : "g ou ml"}
                  </dd>
                </div>
                <div>
                  <dt>Proporção</dt>
                  <dd className="mono">
                    {method.kind === "moka"
                      ? `≈ ${formatRatio(recipe.ratio)}`
                      : formatRatio(recipe.ratio)}
                    {recipe.effectiveRatio !== recipe.ratio &&
                      method.kind !== "moka" && (
                        <span className="xp-approx">
                          {" "}
                          · efetiva {formatRatio(recipe.effectiveRatio)}
                        </span>
                      )}
                  </dd>
                </div>
                <div>
                  <dt>{method.kind === "cold" ? "Rende" : "Na xícara"}</dt>
                  <dd>
                    {recipe.beverageMl === null
                      ? `cerca de ${recipe.servings} xícaras pequenas`
                      : method.kind === "cold"
                        ? `≈ ${formatNumber(recipe.concentrateMl ?? 0)} ml de concentrado → ${formatNumber(recipe.beverageMl)} ml de bebida`
                        : `≈ ${formatNumber(recipe.beverageMl)} ml no total`}
                  </dd>
                </div>
                <div>
                  <dt>Moagem</dt>
                  <dd>
                    {level === "iniciante"
                      ? method.grind.beginner
                      : method.grind.advanced}
                  </dd>
                </div>
                <div>
                  <dt>Temperatura</dt>
                  <dd>
                    {level === "avancado" && method.temperature.celsius
                      ? `${method.temperature.celsius[0]} a ${method.temperature.celsius[1]} °C. `
                      : ""}
                    {method.temperature.beginner}
                  </dd>
                </div>
                <div>
                  <dt>Tempo</dt>
                  <dd>{method.time.label}</dd>
                </div>
                {level === "avancado" && recipe.perRound.bloomGrams && (
                  <div>
                    <dt>Pré-infusão</dt>
                    <dd>
                      {formatNumber(recipe.perRound.bloomGrams)} g (
                      {formatNumber(method.bloomFactor ?? 0)}× o café)
                    </dd>
                  </div>
                )}
              </dl>
              {method.kind === "espresso" &&
                method.espresso &&
                level === "avancado" && (
                  <label className="xp-dose">
                    <span>Dose do seu cesto (g)</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={method.espresso.minDose}
                      max={method.espresso.maxDose}
                      step={0.5}
                      value={dose ?? method.espresso.defaultDose}
                      onChange={(event) =>
                        setDose(Number(event.target.value) || undefined)
                      }
                    />
                  </label>
                )}
              {recipe.warnings.map((warning) => (
                <p key={warning} className="xp-warning" role="note">
                  {warning}
                </p>
              ))}
              {recipe.notes.map((note) => (
                <p key={note} className="xp-small">
                  {note}
                </p>
              ))}
              <p className="xp-small">
                É um ponto de partida ajustável, não uma regra. Prove e ajuste
                ao seu gosto.
              </p>
              <div className="xp-hero-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() => {
                    scrollTo(tutorialHeading.current);
                    tutorialHeading.current?.focus({ preventScroll: true });
                  }}
                >
                  Começar o preparo guiado <Arrow />
                </button>
                <button
                  type="button"
                  className="xp-button-ghost"
                  onClick={() => {
                    if (!journal) return;
                    const name = `${coffee?.name ?? "Café"} · ${method.name}`;
                    const ok = persist(
                      addFavorite(journal, {
                        name,
                        coffeeSlug: coffeeSlug || undefined,
                        params: recipe.params,
                        summary: summarizeRecipe(method, recipe),
                      }),
                    );
                    setSaved(
                      ok
                        ? "Receita salva em Minha jornada."
                        : "Este navegador não permitiu salvar (navegação privada ou armazenamento bloqueado).",
                    );
                  }}
                >
                  Salvar receita
                </button>
                <Link
                  className="xp-text-link"
                  href="/experiencia/minha-jornada/"
                >
                  Minha jornada
                </Link>
              </div>
              <p className="xp-small" role="status">
                {saved}
              </p>

              <div className="xp-tutorial-layout">
                <div>
                  <h3 className="eyebrow" ref={tutorialHeading} tabIndex={-1}>
                    PREPARO GUIADO
                  </h3>
                  <ol className="xp-tutorial">
                    {recipe.steps.map((step, index) => {
                      const timedIndex = recipe.schedule.findIndex(
                        (item) =>
                          item.at === step.at && item.title === step.title,
                      );
                      const state =
                        timedIndex === -1 || activeStep === -1
                          ? ""
                          : timedIndex === activeStep
                            ? "is-active"
                            : timedIndex < activeStep
                              ? "is-done"
                              : "";
                      return (
                        <li
                          key={`${step.title}-${index}`}
                          className={state}
                          aria-current={
                            state === "is-active" ? "step" : undefined
                          }
                        >
                          <span className="xp-step-number mono">
                            {index + 1}
                          </span>
                          <div>
                            <h4>
                              {step.title}
                              {step.at !== undefined && method.timer && (
                                <span className="mono xp-step-time">
                                  {formatClock(step.at)}
                                </span>
                              )}
                            </h4>
                            <p>{step.text}</p>
                            {step.targetGrams !== undefined && (
                              <p className="mono xp-step-target">
                                Balança: {formatNumber(step.targetGrams)} g
                              </p>
                            )}
                            {step.observe && (
                              <p className="xp-step-observe">
                                Observe: {step.observe}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
                <div className="xp-timer-wrap">
                  {method.timer && recipe.totalSeconds ? (
                    <>
                      <h3 className="eyebrow">CRONÔMETRO</h3>
                      <p className="xp-small">{method.timer.start}</p>
                      <BrewTimer
                        schedule={recipe.schedule}
                        totalSeconds={recipe.totalSeconds}
                        methodId={method.id}
                        startButton={method.timer.button}
                        startHint={method.timer.start}
                        rounds={recipe.rounds}
                        roundLabel={recipe.roundLabel}
                        onStepChange={setActiveStep}
                        onFinish={finish}
                      />
                    </>
                  ) : (
                    <p className="xp-callout">
                      {method.kind === "cold"
                        ? "O cold brew leva de 12 a 18 horas: anote o horário em que começou e siga o passo a passo."
                        : "Neste método a máquina controla o tempo. Siga o passo a passo."}
                    </p>
                  )}
                  <button
                    type="button"
                    className="xp-button-ghost xp-finish"
                    onClick={() => {
                      trackExperience("tutorial_complete", {
                        method: method.id,
                        via: "botao",
                      });
                      finish();
                    }}
                  >
                    Terminei o preparo
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="xp-warning" role="alert">
              {recipe.error}
            </p>
          )}
        </section>
      )}

      {method && recipe?.ok && (
        <section className="xp-section" aria-labelledby="calc-title">
          <p className="eyebrow">CALCULADORA DE PROPORÇÃO</p>
          <h2 id="calc-title">
            Faça a conta <em>do seu jeito.</em>
          </h2>
          <RatioCalculator
            key={`${method.id}-${recipe.perRound.coffeeGrams}-${recipe.perRound.waterGrams}`}
            initialCoffee={recipe.perRound.coffeeGrams}
            initialRatio={recipe.ratio}
            initialWater={recipe.perRound.waterGrams}
            presets={method.presets ?? [recipe.ratio]}
            beverage={recipe.ratioMeaning === "beverage"}
          />
        </section>
      )}

      {method && recipe?.ok && (
        <section
          className="xp-section"
          ref={diagnosisRef}
          aria-labelledby="diag-title"
          tabIndex={-1}
        >
          <p className="eyebrow">DIAGNÓSTICO DO PREPARO</p>
          <h2 id="diag-title">
            {finished ? "Hora de provar." : "Depois de preparar,"}{" "}
            <em>conte como ficou.</em>
          </h2>
          {finished && entryId && (
            <p className="xp-small">
              Preparo registrado em Minha jornada, só neste navegador.
            </p>
          )}
          <BrewDiagnosis
            key={`${entryId ?? "novo"}-${method.id}`}
            diagnosis={diagnosis}
            methodId={method.id}
            onRate={(id) => {
              const outcome = id as BrewEntry["outcome"];
              setRated(outcome);
              if (journal && entryId)
                persist(rateEntry(journal, entryId, { outcome }));
            }}
            onRetry={retry}
            baristaHref={baristaHref}
          />
          {suggestion && (
            <aside
              className="xp-next-coffee"
              aria-label="Sugestão para a próxima compra"
            >
              <p className="eyebrow">QUANDO QUISER VARIAR</p>
              <p>
                <strong>{suggestion.coffee.name}.</strong> {suggestion.reason}
              </p>
              <Link
                className="xp-text-link"
                href={`/experiencia/cafes/${suggestion.coffee.slug}/`}
              >
                Conhecer o {suggestion.coffee.name} <Arrow />
              </Link>
            </aside>
          )}
        </section>
      )}
    </div>
  );
}
