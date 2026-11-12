import type { Metadata } from "next";
// Operations panel: never indexed, never linked from the public site.
export const metadata: Metadata = {
  title: "Painel | Cura Café",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
