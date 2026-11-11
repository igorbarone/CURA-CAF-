"use client";
import Link from "next/link";
import { useState } from "react";
import { diagnose } from "../../lib/experience/diagnosis";
import { trackExperience } from "../../lib/experience/analytics";
import type { Diagnosis } from "../../lib/experience/schema";

/** "Como ficou seu café?" — one suggestion at a time, never a verdict. */
export function BrewDiagnosis({
  diagnosis,
  methodId,
}: {
  diagnosis: Diagnosis;
  methodId?: string;
}) {
  const [choice, setChoice] = useState("");
  const [shown, setShown] = useState(0);
  const result = choice ? diagnose(diagnosis, choice, methodId) : null;
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
                onChange={() => {
                  setChoice(option.id);
                  setShown(0);
                  trackExperience("diagnosis_select", {
                    result: option.id,
                    method: methodId,
                  });
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {result && (
        <div className="xp-diagnosis-result" aria-live="polite">
          <p>{result.summary}</p>
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
            </div>
          )}
          {result.then.slice(0, shown).map((item, index) => (
            <div className="xp-suggestion is-next" key={item.text}>
              <h4 className="eyebrow">SE AINDA NÃO RESOLVER · {index + 2}</h4>
              <p>{item.text}</p>
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
          <p>
            <Link className="xp-text-link" href="/experiencia/barista/">
              Conversar com o Barista Cura sobre isso
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
