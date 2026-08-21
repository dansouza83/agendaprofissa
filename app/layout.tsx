import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import { PwaRegistration } from "./pwa";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Agenda Profissa — Gestão de agendamentos", template: "%s" },
  description: "Agenda, clientes e serviços para profissionais autônomos.",
  manifest: "/manifest.webmanifest",
  themeColor: "#08140f",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Agenda Profissa" },
  openGraph: {
    title: "Agenda Profissa — Seu negócio organizado",
    description: "Agenda, clientes e serviços para profissionais autônomos.",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Agenda Profissa — Seu negócio organizado" }],
  },
  twitter: { card: "summary_large_image", title: "Agenda Profissa — Seu negócio organizado", description: "Agenda, clientes e serviços para profissionais autônomos.", images: ["/og.png"] },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className="dark" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:`document.documentElement.classList.add("dark");try{localStorage.removeItem("agenda-facil-theme")}catch(e){}`}}/></head><body><PwaRegistration />{children}</body></html>;
}
