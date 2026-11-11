"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Arrow } from "../arrow";
import { BrewTimer } from "./brew-timer";
import { BrewDiagnosis } from "./brew-diagnosis";
import { RatioCalculator } from "./ratio-calculator";
import { ProductCta } from "./product-cta";
import {
  formatClock,
  formatNumber,
  formatRatio,
  generateRecipe,
  methodFit,
  type RecipeInput,
} from "../../lib/experience/brew";
import { trackExperience } from "../../lib/experience/analytics";
import { STORAGE, readLocal, writeLocal } from "../../lib/experience/storage";
import type { ExperienceCoffee } from "../../lib/experience/coffee";
import type {
  BrewMethod,
  Diagnosis,
  Strength,
} from "../../lib/experience/schema";

type Mode = RecipeInput["mode"];
type Level = "iniciante" | "avancado";
type Saved = {
  method?: string;
  mode?: Mode;
  amount?: number;
  strength?: Strength;
};
const strengthCopy: Record<Strength, string> = {
  suave: "Mais suave",
  equilibrado: "Equilibrada",
  intenso: "Mais intensa",
};
const defaultAmount: Record<Mode, number> = { cups: 2, coffee: 20, water: 300 };

export function BrewLab({
  methods,
  coffees,
  diagnosis,
}: {
  methods: BrewMethod[];
  coffees: ExperienceCoffee[];
  diagnosis: Diagnosis;
}) {
  const [coffeeSlug, setCoffeeSlug] = useState("");
  const [methodId, setMethodId] = useState("");
  const [mode, setMode] = useState<Mode>("cups");
  const [amountText, setAmountText] = useState(String(defaultAmount.cups));
  const [strength, setStrength] = useState<Strength>("equilibrado");
  const [level, setLevel] = useState<Level>("iniciante");
  const [activeStep, setActiveStep] = useState(-1);
  const [finished, setFinished] = useState(false);
  const recipeHeading = useRef<HTMLHeadingElement>(null);
  const diagnosisRef = useRef<HTMLDivElement>(null);

  // URL parameters (QR deep links, Barista, coffee pages) win over memory.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const saved = readLocal<Saved>(STORAGE.brew, {});
    const remembered = readLocal<string>(STORAGE.coffee, "");
    const cafe = params.get("cafe") ?? remembered;
    if (coffees.some((coffee) => coffee.slug === cafe)) setCoffeeSlug(cafe);
    const method = params.get("metodo") ?? saved.method;
    if (method && methods.some((item) => item.id === method))
      setMethodId(method);
    const cups = Number(params.get("xicaras"));
    if (cups > 0 && cups <= 20) {
      setMode("cups");
      setAmountText(String(cups));
    } else if (saved.mode && saved.amount) {
      setMode(saved.mode);
      setAmountText(String(saved.amount));
    }
    if (saved.strength) setStrength(saved.strength);
    setLevel(readLocal<Level>(STORAGE.level, "iniciante"));
  }, [coffees, methods]);

  const method = methods.find((item) => item.id === methodId);
  const coffee = coffees.find((item) => item.slug === coffeeSlug);
  const amount = Number(amountText.replace(",", "."));
  const recipe = useMemo(
    () => (method ? generateRecipe(method, { mode, amount }, strength) : null),
    [method, mode, amount, strength],
  );
  useEffect(() => {
    if (!method || !(amount > 0)) return;
    writeLocal(STORAGE.brew, { method: method.id, mode, amount, strength });
  }, [method, mode, amount, strength]);
  useEffect(() => {
    if (method)
      trackExperience("recipe_generate", { method: method.id, strength });
  }, [method, strength]);
  useEffect(() => setFinished(false), [methodId]);

  const finish = useCallback(() => {
    setFinished(true);
    requestAnimationFrame(() =>
      diagnosisRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      }),
    );
  }, []);
  const fit = method ? methodFit(method, coffee) : "unknown";
  const modeLabels: Record<Mode, string> = {
    cups: method?.cupIsDose ? "Doses" : "Xícaras",
    coffee: "Café que tenho (g)",
    water:
      method?.ratioMeaning === "beverage"
        ? "Bebida desejada (g)"
        : "Água que tenho (g)",
  };
  const valid = recipe && recipe.coffeeGrams > 0 && recipe.waterGrams > 0;

  return (
    <div className="xp-lab">
      <section className="xp-lab-panel" aria-labelledby="lab-setup">
        <h2 id="lab-setup" className="xp-visually-hidden">
          Monte sua receita
        </h2>
        <fieldset className="xp-lab-step">
          <legend>
            <span className="mono">1</span> Qual café da Cura você vai usar?
          </legend>
          <div className="xp-chip-row">
            {coffees.map((item) => (
              <label key={item.slug} className="xp-chip-option">
                <input
                  type="radio"
                  name="cafe"
                  checked={coffeeSlug === item.slug}
                  onChange={() => {
                    setCoffeeSlug(item.slug);
                    writeLocal(STORAGE.coffee, item.slug);
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
                onChange={() => setCoffeeSlug("")}
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
            {methods.map((item) => {
              const itemFit = methodFit(item, coffee);
              return (
                <label
                  key={item.id}
                  className={`xp-method-card ${methodId === item.id ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="metodo"
                    checked={methodId === item.id}
                    onChange={() => {
                      setMethodId(item.id);
                      trackExperience("method_select", {
                        method: item.id,
                        coffee: coffeeSlug || undefined,
                      });
                      requestAnimationFrame(() =>
                        recipeHeading.current?.focus({ preventScroll: true }),
                      );
                    }}
                  />
                  <span className="xp-method-name">{item.name}</span>
                  <span className="xp-method-summary">{item.summary}</span>
                  {itemFit === "label" && coffee && (
                    <span className="xp-badge mono">Sugerido no rótulo</span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>

        {method && (
          <>
            <fieldset className="xp-lab-step">
              <legend>
                <span className="mono">3</span> Quanto você quer preparar?
              </legend>
              <div
                className="xp-segmented"
                role="group"
                aria-label="Calcular a partir de"
              >
                {(Object.keys(modeLabels) as Mode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={mode === item}
                    onClick={() => {
                      setMode(item);
                      setAmountText(String(defaultAmount[item]));
                    }}
                  >
                    {item === "cups"
                      ? "Por xícaras"
                      : item === "coffee"
                        ? "Pelo café"
                        : "Pela água"}
                  </button>
                ))}
              </div>
              <div className="xp-stepper">
                <button
                  type="button"
                  aria-label="Diminuir"
                  onClick={() =>
                    setAmountText(
                      String(
                        Math.max(
                          mode === "cups" ? 1 : 1,
                          (amount || 0) -
                            (mode === "cups" ? 1 : mode === "coffee" ? 1 : 25),
                        ),
                      ),
                    )
                  }
                >
                  −
                </button>
                <label>
                  <span>{modeLabels[mode]}</span>
                  <input
                    inputMode="decimal"
                    value={amountText}
                    onChange={(event) => setAmountText(event.target.value)}
                    aria-describedby="amount-help"
                  />
                </label>
                <button
                  type="button"
                  aria-label="Aumentar"
                  onClick={() =>
                    setAmountText(
                      String(
                        (amount || 0) +
                          (mode === "cups" ? 1 : mode === "coffee" ? 1 : 25),
                      ),
                    )
                  }
                >
                  +
                </button>
              </div>
              <p id="amount-help" className="xp-small">
                {mode === "cups"
                  ? `Uma ${method.cupIsDose ? "dose" : "porção"} = ${method.cup.label}.`
                  : "Informe o que você tem disponível e calculamos o resto."}
              </p>
            </fieldset>

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
                    aria-pressed={strength === item}
                    onClick={() => setStrength(item)}
                  >
                    {strengthCopy[item]}
                  </button>
                ))}
              </div>
            </fieldset>
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
                {method.name},{" "}
                <em>{strengthCopy[strength].toLocaleLowerCase("pt-BR")}.</em>
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
          {coffee && fit === "experiment" && (
            <p className="xp-callout">
              {method.name} não está entre os preparos sugeridos no rótulo do{" "}
              {coffee.name} (
              {coffee.preparations.join(" e ").toLocaleLowerCase("pt-BR")}).
              Funciona como experimento: aproveite para descobrir outro lado do
              café.
            </p>
          )}
          {valid ? (
            <>
              <dl className="xp-recipe-grid">
                <div>
                  <dt>Café</dt>
                  <dd>
                    <span className="xp-big">
                      {formatNumber(recipe.coffeeGrams)}
                    </span>{" "}
                    g
                  </dd>
                </div>
                <div>
                  <dt>
                    {recipe.ratioMeaning === "beverage"
                      ? "Bebida na xícara"
                      : "Água"}
                  </dt>
                  <dd>
                    <span className="xp-big">
                      {formatNumber(recipe.waterGrams)}
                    </span>{" "}
                    {recipe.ratioMeaning === "beverage" ? "g" : "g ou ml"}
                  </dd>
                </div>
                <div>
                  <dt>Proporção</dt>
                  <dd className="mono">{formatRatio(recipe.ratio)}</dd>
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
                  <dt>Tempo estimado</dt>
                  <dd>{method.time.label}</dd>
                </div>
                {level === "avancado" && recipe.bloomGrams && (
                  <div>
                    <dt>Pré-infusão</dt>
                    <dd>
                      {formatNumber(recipe.bloomGrams)} g (
                      {formatNumber(method.bloomFactor ?? 0)}× o café)
                    </dd>
                  </div>
                )}
                {level === "avancado" && (
                  <div>
                    <dt>Rende</dt>
                    <dd>
                      cerca de {formatNumber(recipe.cups)}{" "}
                      {method.cupIsDose
                        ? "dose(s)"
                        : `porção(ões) · ${method.cup.label}`}
                    </dd>
                  </div>
                )}
              </dl>
              {method.capacityNote && (
                <p className="xp-small">{method.capacityNote}</p>
              )}
              {recipe.warnings.map((warning) => (
                <p key={warning} className="xp-warning" role="note">
                  {warning}
                </p>
              ))}
              <p className="xp-small">
                É um ponto de partida ajustável, não uma regra. Prove e ajuste
                ao seu gosto.
              </p>

              <div className="xp-tutorial-layout">
                <div>
                  <h3 className="eyebrow">PASSO A PASSO</h3>
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
                            {level === "avancado" &&
                              step.targetGrams !== undefined && (
                                <p className="mono xp-step-target">
                                  Balança: {formatNumber(step.targetGrams)} g
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
                      <BrewTimer
                        schedule={recipe.schedule}
                        totalSeconds={recipe.totalSeconds}
                        methodId={method.id}
                        onStepChange={setActiveStep}
                        onFinish={finish}
                      />
                    </>
                  ) : (
                    <p className="xp-callout">
                      {method.id === "cold-brew"
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
              Informe uma quantidade maior que zero para calcular a receita.
            </p>
          )}
        </section>
      )}

      {method && (
        <section className="xp-section" aria-labelledby="calc-title">
          <p className="eyebrow">CALCULADORA DE PROPORÇÃO</p>
          <h2 id="calc-title">
            Faça a conta <em>do seu jeito.</em>
          </h2>
          <RatioCalculator
            key={`${method.id}-${recipe?.coffeeGrams}-${recipe?.ratio}`}
            initialCoffee={recipe?.coffeeGrams || 20}
            initialRatio={recipe?.ratio || 15}
            presets={method.presets}
            beverage={method.ratioMeaning === "beverage"}
          />
        </section>
      )}

      {method && (
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
          <BrewDiagnosis diagnosis={diagnosis} methodId={method.id} />
          {coffee && (
            <div className="xp-hero-actions">
              <ProductCta
                coffee={coffee}
                context="laboratorio"
                variant="link"
              />
              <Link
                className="xp-text-link"
                href={`/experiencia/cafes/${coffee.slug}/`}
              >
                Conhecer a origem do {coffee.name} <Arrow />
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
