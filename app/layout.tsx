import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import { PwaRegistration } from "./pwa";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const productionSiteUrl = "https://agendaprofissa.netlify.app";
const metadataSiteUrl = (() => {
  if (!configuredSiteUrl || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configuredSiteUrl)) return productionSiteUrl;
  try {
    return new URL(configuredSiteUrl).origin;
  } catch {
    return productionSiteUrl;
  }
})();
const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${metadataSiteUrl}/#organization`,
      name: "Agenda Profissa",
      url: metadataSiteUrl,
    },
    {
      "@type": "WebSite",
      "@id": `${metadataSiteUrl}/#website`,
      name: "Agenda Profissa",
      url: metadataSiteUrl,
      inLanguage: "pt-BR",
      publisher: { "@id": `${metadataSiteUrl}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${metadataSiteUrl}/#software`,
      name: "Agenda Profissa",
      url: metadataSiteUrl,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "pt-BR",
      description: "Sistema de agendamento para profissionais que organizam agenda, clientes e serviços pelo computador ou celular.",
      provider: { "@id": `${metadataSiteUrl}/#organization` },
      audience: [
        { "@type": "Audience", audienceType: "Esteticistas e profissionais de beleza" },
        { "@type": "Audience", audienceType: "Cabeleireiros, barbeiros e salões" },
        { "@type": "Audience", audienceType: "Personal trainers e profissionais de bem-estar" },
      ],
      featureList: [
        "Agenda de atendimentos",
        "Cadastro de clientes",
        "Cadastro de serviços",
        "Status de atendimento",
        "Acesso pelo computador e celular",
        "Dados separados por negócio",
      ],
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(metadataSiteUrl),
  title: { default: "Agenda Profissa — Sistema de agendamento para profissionais", template: "%s" },
  description: "Software de agendamento para esteticistas, salões, personal trainers e profissionais autônomos. Organize agenda, clientes e serviços pelo celular.",
  applicationName: "Agenda Profissa",
  keywords: ["sistema de agendamento", "agenda online", "agenda para esteticista", "agenda para cabeleireiro", "agenda para personal trainer", "gestão de clientes"],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  verification: googleSiteVerification ? { google: googleSiteVerification } : undefined,
  manifest: "/manifest.webmanifest",
  themeColor: "#08140f",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Agenda Profissa" },
  openGraph: {
    title: "Agenda Profissa — Seu negócio organizado",
    description: "Agenda, clientes e serviços para profissionais autônomos.",
    locale: "pt_BR",
    type: "website",
    url: "/",
    siteName: "Agenda Profissa",
    images: [{ url: "/og.png", width: 1536, height: 1024, alt: "Agenda Profissa — Seu negócio organizado" }],
  },
  twitter: { card: "summary_large_image", title: "Agenda Profissa — Seu negócio organizado", description: "Agenda, clientes e serviços para profissionais autônomos.", images: ["/og.png"] },
  icons: { icon: [{ url: "/brand/agenda-profissa-symbol.png", type: "image/png", sizes: "1254x1254" }], shortcut: [{ url: "/brand/agenda-profissa-symbol.png", type: "image/png", sizes: "1254x1254" }], apple: [{ url: "/brand/agenda-profissa-symbol.png", type: "image/png", sizes: "1254x1254" }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" className="dark" suppressHydrationWarning><head><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} /><script dangerouslySetInnerHTML={{__html:`document.documentElement.classList.add("dark");try{localStorage.removeItem("agenda-facil-theme")}catch(e){}`}}/></head><body><PwaRegistration />{children}</body></html>;
}
