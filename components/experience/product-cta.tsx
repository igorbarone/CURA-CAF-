"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Arrow } from "../arrow";
import { commerceEnabled } from "../../lib/commerce/client";
import {
  productHref,
  rememberEntrySource,
  trackExperience,
} from "../../lib/experience/analytics";
import type { ExperienceCoffee } from "../../lib/experience/coffee";

/**
 * Contextual commerce link. It always leads to the regular product page,
 * where the existing Cura purchase flow (or its "em breve" state) lives.
 */
export function ProductCta({
  coffee,
  label,
  variant = "button",
  context,
}: {
  coffee: Pick<ExperienceCoffee, "slug" | "name" | "productUrl" | "hasOffer">;
  label?: string;
  variant?: "button" | "link";
  context: string;
}) {
  const [href, setHref] = useState(coffee.productUrl);
  useEffect(
    // Reads the entry itself: a QR visit may land directly on this page.
    () =>
      setHref(
        productHref(
          coffee.productUrl,
          rememberEntrySource(window.location.search),
        ),
      ),
    [coffee.productUrl],
  );
  const text =
    label ??
    (commerceEnabled && coffee.hasOffer
      ? `Comprar ${coffee.name} novamente`
      : `Ver ${coffee.name} na loja Cura`);
  return (
    <Link
      className={variant === "button" ? "button xp-buy" : "xp-text-link"}
      href={href}
      onClick={() =>
        trackExperience("product_click", { coffee: coffee.slug, context })
      }
    >
      {text} <Arrow />
    </Link>
  );
}
