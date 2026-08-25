"use client";

import { useEffect, useState } from "react";

export type LegalIdentity = {
  legalName: string;
  document: string;
  address: string;
  supportEmail: string;
  privacyEmail: string;
  configured: boolean;
};

export const legalIdentityPlaceholder: LegalIdentity = {
  legalName: "[PREENCHER RAZÃO SOCIAL OU NOME DO RESPONSÁVEL]",
  document: "[PREENCHER CNPJ OU CPF]",
  address: "[PREENCHER ENDEREÇO COMERCIAL]",
  supportEmail: "[PREENCHER E-MAIL DE SUPORTE]",
  privacyEmail: "[PREENCHER E-MAIL DE PRIVACIDADE]",
  configured: false,
};

const professionalSupportEmail = "dansouzafloripa@gmail.com";

function useLegalIdentity() {
  const [identity, setIdentity] = useState<LegalIdentity>(legalIdentityPlaceholder);

  useEffect(() => {
    let active = true;
    fetch("/api/public/legal-identity", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Não foi possível carregar a identificação.");
        return response.json() as Promise<LegalIdentity>;
      })
      .then(value => { if (active) setIdentity(value); })
      .catch(() => { if (active) setIdentity(legalIdentityPlaceholder); });
    return () => { active = false; };
  }, []);

  return identity;
}

export function ProfessionalSupportLink() {
  const href = `mailto:${professionalSupportEmail}?subject=${encodeURIComponent("Suporte — Agenda Profissa")}`;
  return <a className="professional-support-card flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[#b9ddd2] bg-[#e8f6ef] p-4 text-sm text-[#16483d]" href={href}><span><strong className="professional-support-title block font-extrabold">Falar com o suporte</strong><span className="mt-1 block break-all text-xs">{professionalSupportEmail}</span></span><span aria-hidden="true">↗</span></a>;
}

export function LegalContact({ field }: { field: "privacyEmail" | "supportEmail" }) {
  const identity = useLegalIdentity();
  return <>{identity[field]}</>;
}

export function LegalCompanyIdentification() {
  const identity = useLegalIdentity();
  return <><h2>Identificação do fornecedor</h2><ul><li>Nome empresarial ou responsável: <strong>{identity.legalName}</strong></li><li>CNPJ ou CPF: <strong>{identity.document}</strong></li><li>Endereço: <strong>{identity.address}</strong></li><li>Suporte: <strong>{identity.supportEmail}</strong></li><li>Privacidade e proteção de dados: <strong>{identity.privacyEmail}</strong></li></ul></>;
}

export function LegalIdentityNotice() {
  const identity = useLegalIdentity();
  if (identity.configured) return null;
  return <div className="legal-callout"><strong>Minuta para preparação do lançamento.</strong> Não abra vendas ao público enquanto os campos entre colchetes não forem substituídos pela identificação real do fornecedor e pelos canais ativos de suporte, privacidade e denúncias. Confirme fornecedores, fluxos de cancelamento e reembolso, e submeta o conjunto à revisão de um advogado brasileiro. Nenhum texto, isoladamente, elimina riscos jurídicos.</div>;
}
