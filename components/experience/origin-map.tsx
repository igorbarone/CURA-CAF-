import type { ExperienceCoffee } from "../../lib/experience/coffee";

/**
 * Rendered only when the lot has real, authorised coordinates. It opens the
 * public OpenStreetMap view instead of embedding a third-party map (no
 * tracking, no extra script). Phase 2 may replace it with an interactive map.
 */
export function OriginMap({ coffee }: { coffee: ExperienceCoffee }) {
  const lat = coffee.origin?.latitude;
  const lon = coffee.origin?.longitude;
  if (lat === undefined || lon === undefined) return null;
  const href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=13/${lat}/${lon}`;
  return (
    <p className="xp-map-link">
      <a href={href} target="_blank" rel="noopener noreferrer">
        Ver a localização da fazenda no mapa (abre o OpenStreetMap)
      </a>
    </p>
  );
}
