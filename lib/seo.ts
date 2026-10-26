import type { Metadata } from "next";
export const siteUrl = "https://igorbarone.github.io/CURA-CAF-";
export function canonical(path = "") {
  return `${siteUrl}/${path.replace(/^\//, "")}`;
}
export function metadataFor(
  title: string,
  description: string,
  path = "",
): Metadata {
  return {
    title,
    description,
    alternates: { canonical: canonical(path) },
    openGraph: {
      title,
      description,
      url: canonical(path),
      siteName: "Cura Café",
      locale: "pt_BR",
      type: "website",
    },
    twitter: { card: "summary", title, description },
  };
}
