import type { Metadata } from "next";

export const metadata: Metadata = { title: "Painel do desenvolvedor — Agenda Profissa", description: "Configuração privada das integrações do sistema.", robots: { index: false, follow: false }, openGraph: { images: [] }, twitter: { card: "summary", images: [] } };
export default function DeveloperLayout({children}:{children:React.ReactNode}){return children}
