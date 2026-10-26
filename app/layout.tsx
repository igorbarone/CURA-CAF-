import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Cura Café | Da roça à cidade', description: 'Cafés encontrados na origem, escolhidos com critério e explicados sem complicação.' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="pt-BR"><body>{children}</body></html>}
