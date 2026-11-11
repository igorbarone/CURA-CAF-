import { CuraMark } from "./brand";
import type { CoffeeView } from "../lib/catalog-model";
// Contour lines of a hillside: decoration that echoes the hills on the
// official labels. They describe no real terrain.
function Contours() {
  const lines = Array.from({ length: 9 }, (_, index) => {
    const y = 210 + index * 26;
    const lift = 70 - index * 5;
    return `M-20 ${y} C 70 ${y - lift}, 120 ${y - lift * 1.6}, 190 ${y - lift * 0.4} S 300 ${y + 12}, 360 ${y - lift * 0.9} S 470 ${y - lift * 1.2}, 540 ${y - 6}`;
  });
  return (
    <svg
      className="origin-contours"
      viewBox="0 0 520 470"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {lines.map((d, index) => (
        <path
          key={index}
          d={d}
          style={{ animationDelay: `${index * -1.3}s` }}
        />
      ))}
    </svg>
  );
}
// Home hero panel: the C on top, the hills of origin and a data readout built
// only from published lots (code, score, roast and the origin text as written).
export function OriginConsole({
  coffees,
  signature,
}: {
  coffees: CoffeeView[];
  signature: string;
}) {
  const scored = coffees.filter((coffee) => coffee.score !== null);
  const origin =
    coffees
      .map((coffee) => coffee.origin)
      .find((text) => text.includes(" · ") && !/a confirmar/i.test(text))
      ?.split(" · ")
      .slice(0, 4) ?? [];
  return (
    <div className="hero-art origin-console">
      <Contours />
      <div className="console-grid" aria-hidden="true" />
      <CuraMark className="console-mark" />
      <div className="hero-art-top">
        <span className="eyebrow">ORIGEM → ESCOLHA → CIDADE</span>
        <span className="console-live mono">
          <span className="choice-dot" /> SELEÇÃO{" "}
          {String(coffees.length).padStart(2, "0")}
        </span>
      </div>
      {origin.length > 0 && (
        <ul className="console-origin mono" aria-label="Origem dos lotes">
          {origin.map((part) => (
            <li key={part}>{part}</li>
          ))}
        </ul>
      )}
      {scored.length > 0 && (
        <dl className="console-readout mono">
          {scored.map((coffee) => (
            <div key={coffee.id}>
              <dt>
                {coffee.lot} · {coffee.name}
              </dt>
              <dd>
                <strong>{coffee.score}</strong> SCA · {coffee.roast}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="hero-editorial-note">
        <p className="origin-signature">
          <em>{signature}</em>
        </p>
        <span className="mono">CURADORIA BRASILEIRA</span>
      </div>
    </div>
  );
}
