"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Arrow } from "../arrow";
import { CoffeeMedia } from "./coffee-media";
import { ProductCta } from "./product-cta";
import {
  recommendByTaste,
  type TasteAnswers,
} from "../../lib/experience/taste";
import { trackExperience } from "../../lib/experience/analytics";
import type { ExperienceCoffee } from "../../lib/experience/coffee";
import type { Taste } from "../../lib/experience/schema";

export function TasteQuiz({
  taste,
  coffees,
}: {
  taste: Taste;
  coffees: ExperienceCoffee[];
}) {
  const [answers, setAnswers] = useState<TasteAnswers>({});
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const question = taste.questions[step];
  const focus = () => requestAnimationFrame(() => heading.current?.focus());
  const result = done ? recommendByTaste(coffees, taste, answers) : null;

  if (result?.profile)
    return (
      <section className="xp-quiz xp-quiz-result" aria-labelledby="quiz-result">
        <p className="eyebrow">SEU PERFIL DE PREFERÊNCIA</p>
        <h2 id="quiz-result" ref={heading} tabIndex={-1}>
          {result.profile.name}
        </h2>
        <p className="xp-lead">{result.profile.description}</p>
        {result.recommendations.length ? (
          <ul className="xp-reco">
            {result.recommendations.map(({ coffee, reasons }, index) => (
              <li key={coffee.id} className={coffee.tone}>
                <CoffeeMedia
                  coffee={coffee}
                  sizes="(max-width: 760px) 100vw, 30vw"
                />
                <div>
                  <p className="eyebrow">
                    {index === 0 ? "PARA COMEÇAR" : "TAMBÉM VALE PROVAR"}
                  </p>
                  <h3>{coffee.name}</h3>
                  <p>{coffee.description}</p>
                  <p className="xp-small">Por que combina:</p>
                  <ul className="xp-checks">
                    {reasons.map((reason) => (
                      <li key={reason.trait}>
                        {reason.label}{" "}
                        <span className="mono">({reason.evidence})</span>
                      </li>
                    ))}
                  </ul>
                  <div className="xp-hero-actions">
                    <Link
                      className="xp-text-link"
                      href={`/experiencia/cafes/${coffee.slug}/`}
                    >
                      Conhecer o {coffee.name} <Arrow />
                    </Link>
                    <ProductCta
                      coffee={coffee}
                      context="quiz-paladar"
                      variant="link"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="xp-empty">
            Nenhum café publicado tem, por enquanto, características cadastradas
            que combinem com suas respostas.{" "}
            <Link className="xp-text-link" href="/experiencia/cafes/">
              Conheça a seleção completa
            </Link>
            .
          </p>
        )}
        <p className="xp-small">{taste.disclaimer}</p>
        <button
          type="button"
          className="xp-button-ghost"
          onClick={() => {
            setAnswers({});
            setStep(0);
            setDone(false);
            focus();
          }}
        >
          Refazer o quiz
        </button>
      </section>
    );

  return (
    <section className="xp-quiz" aria-labelledby="quiz-q">
      <p className="eyebrow">
        PERGUNTA {step + 1} DE {taste.questions.length}
      </p>
      <div className="xp-progress-track" aria-hidden="true">
        <span
          style={{ width: `${((step + 1) / taste.questions.length) * 100}%` }}
        />
      </div>
      <fieldset>
        <legend>
          <h2 id="quiz-q" ref={heading} tabIndex={-1}>
            {question.title}
          </h2>
        </legend>
        <div className="xp-choice-grid">
          {question.options.map((option) => (
            <label key={option.id} className="xp-choice">
              <input
                type="radio"
                name={question.id}
                checked={answers[question.id] === option.id}
                onChange={() =>
                  setAnswers({ ...answers, [question.id]: option.id })
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="xp-quiz-nav">
        <button
          type="button"
          className="xp-button-ghost"
          disabled={step === 0}
          onClick={() => {
            setStep(step - 1);
            focus();
          }}
        >
          Voltar
        </button>
        {step < taste.questions.length - 1 ? (
          <button
            type="button"
            className="button"
            onClick={() => {
              setStep(step + 1);
              focus();
            }}
          >
            {answers[question.id] ? "Próxima" : "Pular"} <Arrow />
          </button>
        ) : (
          <button
            type="button"
            className="button"
            disabled={!Object.keys(answers).length}
            onClick={() => {
              const outcome = recommendByTaste(coffees, taste, answers);
              trackExperience("quiz_complete", {
                profile: outcome.profile?.id,
                recommended: outcome.recommendations[0]?.coffee.slug,
                answered: Object.keys(answers).length,
              });
              setDone(true);
              focus();
            }}
          >
            Ver meu perfil <Arrow />
          </button>
        )}
      </div>
    </section>
  );
}
