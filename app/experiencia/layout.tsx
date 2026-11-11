import "./experience.css";
import { Header } from "../../components/header";
import { Footer } from "../../components/footer";
import {
  ExperienceBottomNav,
  ExperienceTopNav,
} from "../../components/experience/experience-nav";
import { EntryTracker } from "../../components/experience/entry-tracker";

// CURA Experience shares the site's header, footer, theme and catalogue; only
// its own navigation is added (top bar on desktop, bottom bar on mobile).
export default function ExperienceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="xp-shell">
      <Header />
      <ExperienceTopNav />
      <main id="conteudo" className="xp-main">
        {children}
      </main>
      <Footer />
      <ExperienceBottomNav />
      <EntryTracker />
    </div>
  );
}
