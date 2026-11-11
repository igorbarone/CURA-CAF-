import {
  sensoryLevelLabels,
  type ExperienceCoffee,
  type SensoryLevel,
} from "../../lib/experience/coffee";

const levelNames = {
  intensity: "Intensidade",
  acidity: "Acidez",
  sweetness: "Doçura",
  body: "Corpo",
} as const;

/**
 * Official sensory sheet. Text attributes come from the label; level bars
 * appear only when the team publishes 1–5 values (documented scale).
 */
export function SensoryProfile({ coffee }: { coffee: ExperienceCoffee }) {
  const sensory = coffee.sensory;
  const levels = Object.entries(sensory?.levels ?? {}) as [
    keyof typeof levelNames,
    SensoryLevel,
  ][];
  if (!sensory && !coffee.profile) return null;
  return (
    <div className="xp-sensory">
      {coffee.profile && <p className="xp-profile-tag">{coffee.profile}</p>}
      {sensory?.notes?.length ? (
        <div>
          <h3 className="eyebrow">NOTAS SENSORIAIS</h3>
          <ul className="xp-chips" aria-label="Notas sensoriais">
            {sensory.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="xp-small">
            Notas descrevem lembranças de aroma e sabor. Não são ingredientes
            adicionados.
          </p>
        </div>
      ) : null}
      {(sensory?.acidity || sensory?.body) && (
        <dl className="xp-dl">
          {sensory.acidity && (
            <div>
              <dt>Acidez</dt>
              <dd>{sensory.acidity}</dd>
            </div>
          )}
          {sensory.body && (
            <div>
              <dt>Corpo</dt>
              <dd>{sensory.body}</dd>
            </div>
          )}
        </dl>
      )}
      {levels.length > 0 && (
        <div className="xp-levels">
          <h3 className="eyebrow">ESCALA SENSORIAL (1 A 5)</h3>
          <ul>
            {levels.map(([key, value]) => (
              <li key={key}>
                <span>{levelNames[key]}</span>
                <span className="xp-level-bar" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <span key={step} className={step <= value ? "is-on" : ""} />
                  ))}
                </span>
                <span className="mono">
                  {value}/5 · {sensoryLevelLabels[value]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
