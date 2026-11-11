"use client";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { trackExperience } from "../../lib/experience/analytics";
import type { TastingAttribute } from "../../lib/experience/schema";

// Heavier interactive modules load on demand, after the lesson text.
const TastingWheel = dynamic(
  () => import("./tasting-wheel").then((mod) => mod.TastingWheel),
  {
    ssr: false,
    loading: () => (
      <p className="xp-loading mono">Carregando a roda sensorial…</p>
    ),
  },
);
const ExtractionSimulator = dynamic(
  () => import("./extraction-simulator").then((mod) => mod.ExtractionSimulator),
  {
    ssr: false,
    loading: () => <p className="xp-loading mono">Carregando o simulador…</p>,
  },
);

export function ModuleInteractive({
  kind,
  attributes,
  coffees,
}: {
  kind: "none" | "tasting" | "extraction";
  attributes: TastingAttribute[];
  coffees: { slug: string; name: string }[];
}) {
  if (kind === "tasting")
    return <TastingWheel attributes={attributes} coffees={coffees} />;
  if (kind === "extraction") return <ExtractionSimulator />;
  return null;
}

export function LessonTracker({ id }: { id: string }) {
  useEffect(
    () => trackExperience("content_view", { content: `modulo-${id}` }),
    [id],
  );
  return null;
}
