import { SelectionProvider } from "../components/selection-provider";
import { getCatalog } from "../lib/coffees";
import type { Metadata } from "next";
import "@fontsource-variable/archivo/standard.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "@fontsource-variable/newsreader/wght-italic.css";
import "./globals.css";
export const metadata: Metadata = {
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/brand/cura-simbolo.svg`,
  },
  metadataBase: new URL("https://igorbarone.github.io"),
  openGraph: {
    siteName: "Cura Café",
    locale: "pt_BR",
    type: "website",
    title: "Cura Café | Democratizar café especial.",
    description:
      "Democratizar café especial. Curadoria brasileira para aproximar o pequeno produtor de quem bebe.",
  },
  twitter: { card: "summary", title: "Cura Café | Democratizar café especial." },
  title: "Cura Café | Democratizar café especial.",
  description:
    "Democratizar café especial: conhecimento, escolha e experiência. Curadoria brasileira, da roça à cidade.",
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
