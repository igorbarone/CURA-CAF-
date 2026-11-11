"use client";
import { useEffect } from "react";
import { trackExperience } from "../../lib/experience/analytics";
import { useCoffeeContext } from "./coffee-context";

/** Opening a coffee's page makes it "seu café" across the Experience. */
export function RememberCoffee({ slug }: { slug: string }) {
  const { setCoffee, ready } = useCoffeeContext();
  useEffect(() => {
    if (!ready) return;
    setCoffee(slug);
    trackExperience("coffee_select", { coffee: slug });
  }, [slug, ready, setCoffee]);
  return null;
}
