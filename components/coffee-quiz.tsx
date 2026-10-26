"use client";
import { Arrow } from "./arrow";
import { useRef, useState } from "react";
import Link from "next/link";
import { catalogFilters, type CatalogEntry } from "../lib/catalog-model";
import { recommendCoffees, type QuizAnswers } from "../lib/quiz";
import type { Editorial } from "../lib/editorial";
export function CoffeeQuiz({
  entries,
  copy,
}: {
  entries: CatalogEntry[];
  copy: Editorial["quiz"];
}) {
  const [answers, setAnswers] = useState<QuizAnswers>({
    profile: "",
    preparation: "",
    roast: "",
  });
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const options = catalogFilters(entries);
  const questions = [
    {
      key: "profile" as const,
      title: "Que perfil chama sua atenção?",
      hint: "Escolha uma sensação que você procura na xícara.",
      options: options.profiles,
    },
    {
      key: "preparation" as const,
      title: "Como você gosta de preparar?",
      hint: "Usamos as sugestões documentadas de cada lote.",
      options: options.preparations,
    },
    {
      key: "roast" as const,
      title: "Tem preferência de torra?",
      hint: "Uma preferência ajuda a refinar a escolha. Não é uma escala de qualidade.",
      options: options.roasts,
    },
  ];
  const question = questions[step];
  const results = recommendCoffees(entries, answers);
  function move(next: number) {
    setError("");
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  }
  if (![...options.profiles, ...options.preparations, ...options.roasts].length)
    return (
      <div className="empty-state">
        <h2>Novas escolhas estão a caminho.</h2>
        <p>{copy.empty}</p>
        <Link className="button" href="/cafes/">
          Explorar o catálogo
        </Link>
      </div>
    );
  return (
    <section className="quiz-panel" aria-label="Quiz sensorial">
      {!complete ? (
        <>
          <p className="eyebrow">
            PASSO {step + 1} DE {questions.length}
          </p>
          <div className="quiz-progress" aria-hidden="true">
            {questions.map((item, i) => (
              <span key={item.key} className={i <= step ? "is-active" : ""} />
            ))}
          </div>
          <h2 ref={heading} tabIndex={-1}>
            {question.title}
          </h2>
          <p className="quiz-hint" id="question-help">
            {question.hint}
          </p>
          <fieldset aria-describedby="question-help">
            <legend className="visually-hidden">{question.title}</legend>
            {question.options.map((option) => (
              <label key={option} className="quiz-option">
                <input
                  type="radio"
                  name={question.key}
                  value={option}
                  checked={answers[question.key] === option}
                  onChange={() => {
                    setAnswers({ ...answers, [question.key]: option });
                    setError("");
                  }}
                />
                <span>{option}</span>
              </label>
            ))}
            <label className="quiz-option">
              <input
                type="radio"
                name={question.key}
                checked={!answers[question.key]}
                onChange={() => {
                  setAnswers({ ...answers, [question.key]: "" });
                  setError("");
                }}
              />
              <span>Quero explorar, sem preferência</span>
            </label>
          </fieldset>
          {error && <p role="alert">{error}</p>}
          <div className="quiz-actions">
            {step > 0 && (
              <button
                className="text-link"
                type="button"
                onClick={() => move(step - 1)}
              >
                Voltar
              </button>
            )}
            <button
              className="button"
              type="button"
              onClick={() => {
                if (step < questions.length - 1) move(step + 1);
                else if (!Object.values(answers).some(Boolean))
                  setError(
                    "Escolha ao menos uma preferência para explicar a recomendação, ou explore o catálogo livremente.",
                  );
                else {
                  setComplete(true);
                  requestAnimationFrame(() => heading.current?.focus());
                }
              }}
            >
              {step === questions.length - 1
                ? "Ver minha recomendação"
                : "Continuar"}{" "}
              <span aria-hidden="true">
                <Arrow />
              </span>
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="eyebrow">ENCONTRADO PARA O SEU MOMENTO</p>
          <h2 tabIndex={-1} ref={heading}>
            {results.length ? copy.resultTitle : "Vamos tentar outro caminho?"}
          </h2>
          <p className="quiz-hint">
            {results.length
              ? "Estes lotes correspondem a todas as preferências escolhidas. Não é garantia de satisfação nem indicação de disponibilidade."
              : copy.noMatch}
          </p>
          <div className="quiz-results">
            {results.map(({ coffee, lotId, reasons }) => (
              <article className={`quiz-result ${coffee.tone}`} key={coffee.id}>
                <p className="eyebrow">{coffee.lot}</p>
                <h3>{coffee.name}</h3>
                <p className="coffee-notes">{coffee.notes}</p>
                <ul>
                  {reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <Link
                  className="button"
                  href={`/cafes/${coffee.slug}/?lote=${encodeURIComponent(lotId)}`}
                >
                  Conheça {coffee.name} <Arrow />
                </Link>
              </article>
            ))}
          </div>
          <div className="quiz-actions">
            <button
              className="text-link"
              type="button"
              onClick={() => {
                setComplete(false);
                move(0);
              }}
            >
              Ajustar respostas
            </button>
            <button
              className="text-link"
              type="button"
              onClick={() => {
                setAnswers({ profile: "", preparation: "", roast: "" });
                setComplete(false);
                move(0);
              }}
            >
              Recomeçar
            </button>
            <Link className="text-link" href="/cafes/">
              Ver todos os cafés
            </Link>
          </div>
        </>
      )}
      <p className="quiz-privacy mono">{copy.help}</p>
    </section>
  );
}
