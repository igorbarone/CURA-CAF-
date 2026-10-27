import { roastLevel } from "../lib/compare";
// Visual echo of the label's roast scale; the visible text carries the meaning.
export function RoastMeter({ roast }: { roast: string }) {
  const level = roastLevel(roast);
  return (
    <span className="roast-meter">
      {level !== null && (
        <span className="roast-steps" aria-hidden="true">
          {[1, 2, 3, 4].map((step) => (
            <span key={step} className={step <= level ? "is-on" : ""} />
          ))}
        </span>
      )}
      <span>{roast}</span>
    </span>
  );
}
