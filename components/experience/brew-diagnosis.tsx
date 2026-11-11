"use client";
import Link from "next/link";
import { useState } from "react";
import { diagnose } from "../../lib/experience/diagnosis";
import { trackExperience } from "../../lib/experience/analytics";
import type { Adjustment, Diagnosis } from "../../lib/experience/schema";

/**
 * "Como ficou seu café?" — one suggestion at a time, never a verdict. When
 * the person cannot tell, it asks one more question instead of concluding.
 * A structured suggestion can be applied to the next attempt.
 */
export function BrewDiagnosis({
  diagnosis,
  methodId,
  onRate,
  onRetry,
  baristaHref,
}: {
  diagnosis: Diagnosis;
  methodId?: string;
  onRate?: (optionId: string) => void;
  onRetry?: (adjustment: Adjustment, text: string) => void;
  baristaHref?: (optionId: string) => string;
}) {
  const [choice, setChoice] = useState("");
  const [shown, setShown] = useState(0);
  const result = choice ? diagnose(diagnosis, choice, methodId) : null;
  const pick = (id: string) => {
    setChoice(id);
    setShown(0);
    onRate?.(id);
    trackExperience("diagnosis_select", { result: id, method: methodId });
  };
  return (
    <div className="xp-diagnosis">
      <fieldset>
        <legend>
          <h3>{diagnosis.question}</h3>
        </legend>
        <div className="xp-choice-grid">
          {diagnosis.options.map((option) => (
            <label key={option.id} className="xp-choice">
              <input
                type="radio"
                name="diagnostico"
                value={option.id}
                checked={choice === option.id}
                onChange={() => pick(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {result && (
        <div className="xp-diagnosis-result" aria-live="polite">
          <p>{result.summary}</p>
          {result.followUp ? (
            <div className="xp-followup">
              <h4>{result.followUp.question}</h4>
              <div className="xp-choice-grid">
                {result.followUp.options.map((option) => (
                  <button
                    key={option.to + option.label}
                    type="button"
                    className="xp-button-ghost"
                    onClick={() => pick(option.to)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {result.checks.length > 0 && (
                <>
                  <h4 className="eyebrow">ANTES DE MUDAR, OBSERVE</h4>
                  <ul className="xp-checks">
                    {result.checks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                </>
              )}
              {result.first && (
                <div className="xp-suggestion">
                  <h4 className="eyebrow">COMECE POR AQUI</h4>
                  <p>{result.first.text}</p>
                  {result.first.apply && onRetry && (
                    <button
                      type="button"
                      className="button"
                      onClick={() =>
                        onRetry(result.first!.apply!, result.first!.text)
                      }
                    >
                      Preparar de novo com este ajuste
                    </button>
                  )}
                </div>
              )}
              {result.then.slice(0, shown).map((item, index) => (
                <div className="xp-suggestion is-next" key={item.text}>
                  <h4 className="eyebrow">
                    SE AINDA NÃO RESOLVER · {index + 2}
                  </h4>
                  <p>{item.text}</p>
                  {item.apply && onRetry && (
                    <button
                      type="button"
                      className="xp-button-ghost"
                      onClick={() => onRetry(item.apply!, item.text)}
                    >
                      Usar este ajuste
                    </button>
                  )}
                </div>
              ))}
              {shown < result.then.length && (
                <button
                  type="button"
                  className="xp-button-ghost"
                  onClick={() => setShown(shown + 1)}
                >
                  Mostrar outra sugestão
                </button>
              )}
              {result.id !== "equilibrado" && (
                <p className="xp-key mono">{result.oneVariable}</p>
              )}
            </>
          )}
          {baristaHref && (
            <p>
              <Link className="xp-text-link" href={baristaHref(result.id)}>
                Perguntar ao Barista Cura sobre este preparo
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
