"use client";
import Link from "next/link";
import { useRef } from "react";
import { Arrow } from "../arrow";
import { CuraMark } from "../brand";
import { trackExperience } from "../../lib/experience/analytics";
import type { Journey } from "../../lib/experience/schema";

/**
 * Cinematic opening. The three paths are always in the HTML (no JS needed to
 * reach them); the CTA only moves focus and scroll to them. Motion is pure
 * CSS and disabled by prefers-reduced-motion.
 */
export function ExperienceIntro({ intro }: { intro: Journey["intro"] }) {
  const paths = useRef<HTMLHeadingElement>(null);
  return (
    <>
      <section className="xp-opening xp-dark" aria-labelledby="xp-title">
        <div className="xp-opening-art" aria-hidden="true">
          <CuraMark className="xp-opening-mark" />
          <span className="xp-opening-line xp-line-1" />
          <span className="xp-opening-line xp-line-2" />
          <span className="xp-opening-line xp-line-3" />
        </div>
        <div className="wrap xp-opening-copy">
          <p className="eyebrow">{intro.eyebrow}</p>
          <h1 id="xp-title">{intro.title}</h1>
          <p className="xp-opening-sub">
            <em>{intro.subtitle}</em>
          </p>
          <button
            type="button"
            className="button xp-start"
            onClick={() => {
              trackExperience("experience_start");
              const target = paths.current;
              if (!target) return;
              const reduce = window.matchMedia(
                "(prefers-reduced-motion: reduce)",
              ).matches;
              target.scrollIntoView({
                behavior: reduce ? "auto" : "smooth",
                block: "start",
              });
              target.focus({ preventScroll: true });
            }}
          >
            {intro.cta} <Arrow />
          </button>
          <p className="xp-opening-foot mono">
            Sem cadastro · Explore no seu ritmo
          </p>
        </div>
      </section>
      <section className="wrap xp-paths" aria-labelledby="xp-paths-title">
        <p className="eyebrow">POR ONDE COMEÇAR</p>
        <h2 id="xp-paths-title" ref={paths} tabIndex={-1}>
          Três caminhos. <em>Escolha o seu.</em>
        </h2>
        <ol className="xp-path-list">
          {intro.paths.map((path, index) => (
            <li key={path.id}>
              <Link
                className="xp-path"
                href={path.href}
                onClick={() =>
                  trackExperience("content_view", {
                    content: `caminho-${path.id}`,
                  })
                }
              >
                <span className="xp-path-number mono">0{index + 1}</span>
                <span className="xp-path-title">{path.title}</span>
                <span className="xp-path-text">{path.text}</span>
                <span className="xp-path-go" aria-hidden="true">
                  <Arrow />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
