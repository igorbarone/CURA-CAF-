"use client";
import { useEffect, useState } from "react";

/** Sticky stage indicator for the origin journey (anchor links + observer). */
export function JourneyProgress({
  stages,
}: {
  stages: { id: string; label: string }[];
}) {
  const [current, setCurrent] = useState(stages[0]?.id);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
        if (visible) setCurrent(visible.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    for (const stage of stages) {
      const element = document.getElementById(stage.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [stages]);
  const index = Math.max(
    0,
    stages.findIndex((stage) => stage.id === current),
  );
  return (
    <nav className="xp-journey-progress" aria-label="Etapas da jornada">
      <div className="xp-progress-track" aria-hidden="true">
        <span style={{ width: `${((index + 1) / stages.length) * 100}%` }} />
      </div>
      <ol>
        {stages.map((stage, i) => (
          <li key={stage.id}>
            <a
              href={`#${stage.id}`}
              aria-current={stage.id === current ? "step" : undefined}
            >
              <span className="mono">{i + 1}</span> {stage.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
