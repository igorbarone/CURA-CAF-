import { SelectionProvider } from "../components/selection-provider";
import { getCatalog } from "../lib/coffees";
import type { Metadata } from "next";
import "@fontsource-variable/archivo";
import "@fontsource/dm-mono/400.css";
import "@fontsource-variable/newsreader/wght-italic.css";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://igorbarone.github.io"),
  openGraph: {
    siteName: "Cura Café",
    locale: "pt_BR",
    type: "website",
    title: "Cura Café | Da roça à cidade",
    description:
      "Curadoria de cafés brasileiros. Encontrado. Escolhido. Explicado.",
  },
  twitter: { card: "summary", title: "Cura Café | Da roça à cidade" },
  title: "Cura Café | Da roça à cidade",
  description:
    "Cafés encontrados na origem, escolhidos com critério e explicados sem complicação.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <SelectionProvider
          validIds={getCatalog().flatMap((entry) =>
            entry.offers.map((offer) => offer.id),
          )}
        >
          {children}
        </SelectionProvider>
      </body>
    </html>
  );
}
