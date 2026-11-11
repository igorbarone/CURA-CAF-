"use client";
import { useEffect } from "react";
import { trackExperience } from "../../lib/experience/analytics";
import { STORAGE, writeLocal } from "../../lib/experience/storage";

/** The Lab pre-selects the last coffee the visitor opened. */
export function RememberCoffee({ slug }: { slug: string }) {
  useEffect(() => {
    writeLocal(STORAGE.coffee, slug);
    trackExperience("coffee_select", { coffee: slug });
  }, [slug]);
  return null;
}
