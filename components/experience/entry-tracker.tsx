"use client";
import { useEffect } from "react";
import {
  rememberEntrySource,
  trackExperience,
} from "../../lib/experience/analytics";

/** Records the entry once per tab (QR code or direct) without personal data. */
export function EntryTracker() {
  useEffect(() => {
    const source = rememberEntrySource(window.location.search);
    try {
      if (sessionStorage.getItem("cura-experience-opened")) return;
      sessionStorage.setItem("cura-experience-opened", "1");
    } catch {
      /* still track once per page load */
    }
    trackExperience("experience_open", {
      source: source ?? "direto",
      path: window.location.pathname,
    });
  }, []);
  return null;
}
