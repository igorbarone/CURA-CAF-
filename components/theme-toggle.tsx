"use client";
import { useEffect, useState } from "react";
export const THEME_KEY = "cura-theme";
// Light (cream) is the brand default; "black" is the visitor's option.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [black, setBlack] = useState(false);
  useEffect(() => {
    setBlack(document.documentElement.dataset.theme === "black");
  }, []);
  function toggle() {
    const next = !black;
    setBlack(next);
    if (next) document.documentElement.dataset.theme = "black";
    else delete document.documentElement.dataset.theme;
    try {
      localStorage.setItem(THEME_KEY, next ? "black" : "light");
    } catch {
      /* the choice just isn't remembered */
    }
  }
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      aria-pressed={black}
      aria-label="Modo black"
      onClick={toggle}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
      <span className="mono">Black</span>
    </button>
  );
}
// Runs before the first paint so a saved choice never flashes the other theme.
export const themeScript = `try{if(localStorage.getItem("${THEME_KEY}")==="black")document.documentElement.dataset.theme="black"}catch(e){}`;
