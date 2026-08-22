"use client";

import { useEffect, useMemo, useState } from "react";
import { SafeLink as Link } from "./safe-link";

type Prices = { monthlyPrice: number; annualPrice: number; currency: "BRL" };
const initialPrices: Prices = { monthlyPrice: 50, annualPrice: 350, currency: "BRL" };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function PublicPricing() {
  const [prices, setPrices] = useState(initialPrices);

  useEffect(() => {
    fetch("/api/public/plans", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Planos indisponíveis.");
        return response.json() as Promise<Prices>;
      })
      .then((result) => {
        if (Number.isFinite(result.monthlyPrice) && Number.isFinite(result.annualPrice)) setPrices(result);
      })
      .catch(() => undefined);
  }, []);

  const annual = useMemo(() => {
    const equivalent = prices.annualPrice / 12;
    const savings = Math.max(0, prices.monthlyPrice * 12 - prices.annualPrice);
    const percentage = prices.monthlyPrice > 0 ? Math.round((savings / (prices.monthlyPrice * 12)) * 100) : 0;
    return { equivalent, savings, percentage };
  }, [prices]);

  return <>
    <div className="pricing-value-grid mx-auto mt-10 max-w-5xl" aria-label="Benefícios da assinatura">
      <article><strong>Mais organização</strong><span>Agenda, clientes e serviços no mesmo painel.</span></article>
      <article><strong>Mais mobilidade</strong><span>Acesse pelo computador ou pelo celular.</span></article>
      <article><strong>Mais segurança</strong><span>Cada negócio mantém seus dados separados.</span></article>
    </div>
    <div className="pricing-grid mx-auto mt-7 max-w-5xl">
      <PublicPlanCard
        label="Plano mensal"
        headline="Flexibilidade para começar"
        price={currency.format(prices.monthlyPrice)}
        period="por mês"
        note={`Cobrança recorrente de ${currency.format(prices.monthlyPrice)} a cada mês, sempre em reais (BRL).`}
        badge="Pagamento mensal"
        benefits={["Painel profissional completo", "Agenda com horários e status", "Cadastro de clientes e serviços", "Uso na web e no celular", "Dados protegidos e separados por negócio"]}
      />
      <PublicPlanCard
        accent
        label="Plano anual"
        headline="Economia para crescer"
        price={currency.format(prices.annualPrice)}
        period="por ano"
        note={`${currency.format(prices.annualPrice)} cobrados a cada 12 meses — equivalente a ${currency.format(annual.equivalent)} por mês.`}
        badge="Melhor custo-benefício"
        highlight={annual.savings > 0 ? `Economize ${currency.format(annual.savings)} por ano (${annual.percentage}%)` : undefined}
        benefits={["Todos os recursos do plano mensal", "Uma única renovação a cada 12 meses", "Mais previsibilidade para o seu negócio", "Uso na web e no celular", "Dados protegidos e separados por negócio"]}
      />
    </div>
  </>;
}

function PublicPlanCard({ label, headline, price, period, note, benefits, badge, highlight, accent = false }: { label: string; headline: string; price: string; period: string; note: string; benefits: readonly string[]; badge?: string; highlight?: string; accent?: boolean }) {
  return <article className={`pricing-card ${accent ? "pricing-card-accent" : ""}`}>
    <div className="flex min-h-8 items-center justify-between gap-3"><p className="pricing-label">{label}</p>{badge&&<span className="pricing-badge">{badge}</span>}</div>
    <h3 className="pricing-headline">{headline}</h3>
    <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1"><strong className="pricing-price">{price}</strong><span className="pricing-period">{period}</span></div>
    <p className="pricing-note">{note}</p>
    {highlight&&<p className="pricing-highlight">{highlight}</p>}
    <div className="pricing-divider" />
    <p className="text-sm font-extrabold">Seu negócio organizado todos os dias:</p>
    <ul className="pricing-benefits">{benefits.map((benefit)=><li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>)}</ul>
    <Link className="landing-button landing-button-primary mt-8 w-full" href="/sistema?cadastro=profissional">Criar conta profissional <span>→</span></Link>
  </article>;
}
