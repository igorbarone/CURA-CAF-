import "./experience.css";
import type { Metadata } from "next";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import {
  ExperienceBottomNav,
  ExperienceTopNav,
} from "../../components/experience/experience-nav";
import { EntryTracker } from "../../components/experience/entry-tracker";
import {
  CoffeeContextBar,
  CoffeeContextProvider,
} from "../../components/experience/coffee-context";
import { getExperienceCoffees } from "../../lib/experience/content";

// Reached only through the QR code printed on every package (no public links,
// not in the sitemap). noindex keeps it out of search results; it is NOT an
// access control: anyone with the link can open it, and that is acceptable.
// Page metadata merges with this, so every route under /experiencia inherits it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// CURA Experience shares the site's header, footer, theme and catalogue; only
// its own navigation is added (top bar on desktop, bottom bar on mobile).
export default function ExperienceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const coffees = getExperienceCoffees().map(({ slug, name }) => ({
    slug,
    name,
  }));
  return (
    <CoffeeContextProvider coffees={coffees}>
      <div className="xp-shell">
        <Header />
        <ExperienceTopNav />
        <CoffeeContextBar />
        <main id="conteudo" className="xp-main">
          {children}
        </main>
        <Footer />
        <ExperienceBottomNav />
        <EntryTracker />
      </div>
    </CoffeeContextProvider>
  );
}
