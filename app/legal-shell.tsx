import type { Metadata } from "next";
import { Breadcrumbs } from "./breadcrumbs";
import { SafeLink as Link } from "./safe-link";
import { PublicFooter, PublicHeader } from "./public-shell";
import { LegalCompanyIdentification, LegalContact, LegalIdentityNotice, legalIdentityPlaceholder } from "./legal-identity";

export const legalIdentity = legalIdentityPlaceholder;
export { LegalContact };

export const legalPages = [
  ["Termos de Uso", "/termos", "Regras do serviço, contas e responsabilidades."],
  ["Pagamentos e Prevenção a Fraudes", "/antifraude", "Como reconhecer cobranças legítimas e reportar tentativas de golpe."],
  ["Aviso de Privacidade", "/privacidade", "Como os dados pessoais são tratados."],
  ["Política de Cookies", "/cookies", "Tecnologias usadas no navegador."],
  ["Diretrizes de Uso", "/diretrizes", "Condutas permitidas e proibidas."],
  ["Segurança", "/seguranca", "Medidas técnicas e responsabilidades."],
  ["Direitos do Titular", "/direitos-do-titular", "Como exercer direitos previstos na LGPD."],
  ["Perguntas Frequentes", "/faq", "Respostas sobre contas e funcionamento."],
] as const;

export function legalMetadata(title: string, description: string, path: string): Metadata {
  const hiddenDraft = !["/faq", "/seguranca"].includes(path);
  return {
    title: `${title} — Agenda Profissa`, description, alternates: { canonical: path },
    ...(hiddenDraft ? { robots: { index: false, follow: false } } : {}),
    openGraph: { title: `${title} — Agenda Profissa`, description, type: "article", locale: "pt_BR", images: [] },
    twitter: { card: "summary", title: `${title} — Agenda Profissa`, description, images: [] },
  };
}

export function LegalPage({ eyebrow = "Centro de confiança", title, description, children, draft = true, breadcrumbParent = true }: { eyebrow?: string; title: string; description: string; children: React.ReactNode; draft?: boolean; breadcrumbParent?: boolean }) {
  const isLegalHub=title==="Centro jurídico e de confiança";
  const crumbs=isLegalHub||!breadcrumbParent?[{label:"Início",href:"/"},{label:title}]:[{label:"Início",href:"/"},{label:"Centro jurídico",href:"/legal"},{label:title}];
  return <div className="legal-surface min-h-screen bg-[#f8faf7]"><PublicHeader/><main><section className="legal-hero border-b border-[#e1e9e4] bg-[#edf6f1] px-4 py-14 sm:px-6 lg:py-20"><div className="mx-auto max-w-5xl"><Breadcrumbs items={crumbs} className="mb-7"/><p className="section-eyebrow">{eyebrow}</p><h1 className="max-w-4xl text-4xl font-black tracking-[-.045em] text-[#173f37] sm:text-6xl">{title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-[#60716b]">{description}</p><p className="mt-5 text-xs font-bold uppercase tracking-[.1em] text-[#76857f]">Última atualização: 22 de agosto de 2026</p></div></section><div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:py-16"><article className="legal-copy min-w-0">{draft&&<LegalIdentityNotice/>}{children}</article><aside className="order-first lg:order-last"><div className="legal-toc sticky top-24 rounded-2xl border border-[#e1e9e4] bg-white p-5"><p className="text-xs font-black uppercase tracking-[.12em] text-[#2f7d70]">Documentos</p>{legalPages.map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</div></aside></div></main><PublicFooter/></div>;
}

export function DraftNotice() {
  return <div className="legal-callout"><strong>Minuta para preparação do lançamento.</strong> Não abra vendas ao público enquanto os campos entre colchetes não forem substituídos pela identificação real do fornecedor e pelos canais ativos de suporte, privacidade e denúncias. Confirme fornecedores, fluxos de cancelamento e reembolso, e submeta o conjunto à revisão de um advogado brasileiro. Nenhum texto, isoladamente, elimina riscos jurídicos.</div>;
}

export function CompanyIdentification() {
  return <LegalCompanyIdentification/>;
}
