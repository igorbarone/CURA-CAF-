import { Header } from "./header";
import { Footer } from "./footer";
import { Breadcrumbs } from "./breadcrumbs";
export function EditorialShell({
  current,
  children,
}: {
  current: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="conteudo" className="wrap editorial-page">
        <Breadcrumbs current={current} />
        {children}
      </main>
      <Footer />
    </>
  );
}
