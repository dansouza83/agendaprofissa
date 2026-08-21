import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acessar ou criar conta — Agenda Profissa",
  description: "Acesse o Agenda Profissa ou crie seu perfil profissional, de aluno ou cliente.",
  robots: { index: false, follow: false },
  openGraph: { images: [] },
  twitter: { card: "summary", images: [] },
};

export default function SystemLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
