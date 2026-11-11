"use client";
import { useState } from "react";
import type { Journey } from "../../lib/experience/schema";

/** Florada → Beneficiamento, one stage at a time (tabs pattern). */
export function HarvestCycle({
  cycle,
  process,
}: {
  cycle: Journey["cycle"];
  process?: string;
}) {
  const [active, setActive] = useState(0);
  const stage = cycle[active];
  return (
    <div className="xp-cycle">
      <div className="xp-cycle-steps" role="tablist" aria-label="Ciclo do café">
        {cycle.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`ciclo-${item.id}`}
            aria-selected={index === active}
            aria-controls="ciclo-painel"
            tabIndex={index === active ? 0 : -1}
            className={index <= active ? "is-past" : ""}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              const delta =
                event.key === "ArrowRight"
                  ? 1
                  : event.key === "ArrowLeft"
                    ? -1
                    : 0;
              if (!delta) return;
              event.preventDefault();
              const next = (active + delta + cycle.length) % cycle.length;
              setActive(next);
              document.getElementById(`ciclo-${cycle[next].id}`)?.focus();
            }}
          >
            <span className="mono">{String(index + 1).padStart(2, "0")}</span>
            {item.title}
          </button>
        ))}
      </div>
      <div
        className="xp-cycle-panel"
        role="tabpanel"
        id="ciclo-painel"
        aria-labelledby={`ciclo-${stage.id}`}
        key={stage.id}
      >
        <h4>{stage.title}</h4>
        <p>{stage.text}</p>
        {process && stage.id === "secagem" && (
          <p className="xp-callout">
            <strong>No seu café:</strong> processo{" "}
            {process.toLocaleLowerCase("pt-BR")}, segundo o rótulo.
          </p>
        )}
      </div>
    </div>
  );
}
