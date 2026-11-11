"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
export type ShowcaseSlide = {
  id: string;
  name: string;
  lot: string;
  notes: string;
  score: number | null;
  roast: string;
  href: string;
  src: string;
  kind: "photograph" | "artwork" | "illustration";
  price: string | null;
};
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const INTERVAL = 5000;
// Home hero: the published coffees take turns (package image + key facts).
// Pauses on hover/focus, never autoplays with reduced motion.
export function HeroShowcase({
  slides,
  signature,
}: {
  slides: ShowcaseSlide[];
  signature: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % slides.length),
      INTERVAL,
    );
    return () => clearInterval(timer);
  }, [paused, slides.length]);
  const slide = slides[index];
  return (
    <div
      className="hero-art hero-showcase"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="showcase-stage" aria-hidden="true">
        {slide?.kind === "illustration" && (
          <span className="showcase-badge mono">Ilustração digital</span>
        )}
        {slides.map((item, position) => (
          <Image
            key={item.id}
            className={position === index ? "is-active" : ""}
            src={`${base}${item.src}`}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 45vw"
            priority={position === 0}
          />
        ))}
      </div>
      {slide ? (
        <div className="showcase-panel" aria-live="polite">
          <p className="showcase-signature">
            <span className="origin-signature">
              <em>{signature}</em>
            </span>
            <span className="mono showcase-lot">{slide.lot}</span>
          </p>
          <div className="showcase-head">
            <p className="showcase-name">{slide.name}</p>
            {slide.score !== null && (
              <p className="showcase-score">
                <strong>{slide.score}</strong>
                <span className="mono">pontos SCA</span>
              </p>
            )}
          </div>
          <p className="showcase-notes">
            <em>{slide.notes}</em>
            <span className="mono"> · torra {slide.roast.toLowerCase()}</span>
          </p>
          <div className="showcase-foot">
            {slide.price && (
              <span className="mono showcase-price">
                a partir de {slide.price}
              </span>
            )}
            <Link className="text-link showcase-link" href={slide.href}>
              Conheça {slide.name}
            </Link>
          </div>
        </div>
      ) : (
        <div className="showcase-panel">
          <p className="showcase-signature">
            <span className="origin-signature">
              <em>{signature}</em>
            </span>
          </p>
        </div>
      )}
      {slides.length > 1 && (
        <div className="showcase-tabs" role="group" aria-label="Escolher café">
          {slides.map((item, position) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={position === index}
              onClick={() => setIndex(position)}
            >
              <span className="mono">{item.name}</span>
              <span
                className="showcase-progress"
                aria-hidden="true"
                style={
                  position === index && !paused
                    ? { animationDuration: `${INTERVAL}ms` }
                    : undefined
                }
                data-run={position === index && !paused ? "1" : "0"}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
