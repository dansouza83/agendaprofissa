"use client";

import { useEffect, useState } from "react";

const previewTabs = [
  { id: "inicio", icon: "⌂", label: "Início" },
  { id: "agenda", icon: "□", label: "Agenda" },
  { id: "clientes", icon: "♙", label: "Clientes" },
  { id: "servicos", icon: "◇", label: "Serviços" },
] as const;

type PreviewTab = (typeof previewTabs)[number]["id"];
type PreviewDevice = "mobile" | "web";

const appointments = [
  ["09:00", "Ana Paula", "Manicure", "confirmado", "#e59467"],
  ["11:00", "Beatriz Souza", "Sobrancelhas", "pendente", "#8a75ba"],
  ["14:30", "Carla Mendes", "Limpeza de pele", "confirmado", "#56a796"],
] as const;

const customers = [
  ["AS", "Ana Souza", "(48) 99955-4411", "3 atendimentos"],
  ["BR", "Beatriz Ramos", "(48) 98810-2204", "2 atendimentos"],
  ["CM", "Carla Mendes", "(48) 99104-3382", "5 atendimentos"],
  ["LR", "Lucas Rocha", "(48) 98442-7710", "1 atendimento"],
] as const;

const services = [
  ["Manicure", "60 minutos", "R$ 65", "#e59467"],
  ["Design de sobrancelhas", "45 minutos", "R$ 55", "#8a75ba"],
  ["Limpeza de pele", "90 minutos", "R$ 140", "#56a796"],
  ["Treino funcional", "50 minutos", "R$ 80", "#d08a58"],
] as const;

export function DashboardPreview() {
  const [active, setActive] = useState<PreviewTab>("inicio");
  const [device, setDevice] = useState<PreviewDevice>("mobile");
  const activeLabel = previewTabs.find((tab) => tab.id === active)?.label ?? "Início";

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      const current = previewTabs.findIndex((tab) => tab.id === active);
      setActive(previewTabs[(current + 1) % previewTabs.length].id);
    }, 3800);
    return () => window.clearTimeout(timer);
  }, [active]);

  function selectDevice(nextDevice: PreviewDevice) {
    setDevice(nextDevice);
    setActive("inicio");
  }

  return (
    <div className={`dashboard-preview-showcase dashboard-preview-${device} relative mx-auto min-w-0 w-full max-w-2xl lg:mx-0`}>
      <div className="preview-device-picker">
        <span><b>Experimente agora</b><small>Comece pelo celular</small></span>
        <div role="tablist" aria-label="Escolha o formato da demonstração">
          <button type="button" role="tab" aria-selected={device === "mobile"} className={device === "mobile" ? "active" : ""} onClick={() => selectDevice("mobile")}><span aria-hidden="true">▯</span> Celular</button>
          <button type="button" role="tab" aria-selected={device === "web"} className={device === "web" ? "active" : ""} onClick={() => selectDevice("web")}><span aria-hidden="true">▱</span> Computador</button>
        </div>
      </div>
      {device === "mobile" ? <MobilePreview active={active} activeLabel={activeLabel} setActive={setActive} /> : <WebPreview active={active} activeLabel={activeLabel} setActive={setActive} />}
      <div className="preview-float"><span>✓</span><div><b>{device === "mobile" ? "Praticidade no celular" : "Visão completa na web"}</b><small>Toque no menu para explorar</small></div></div>
    </div>
  );
}

function WebPreview({ active, activeLabel, setActive }: { active: PreviewTab; activeLabel: string; setActive: (tab: PreviewTab) => void }) {
  return <div className="preview-window panel-demo professional-workspace system-theme" data-preview-tab={active}>
    <div className="preview-top"><div className="flex gap-1.5"><i /><i /><i /></div><span>app.agendaprofissa.com.br</span><b>—</b></div>
    <div className="panel-demo-app">
      <aside className="panel-demo-sidebar preview-side">
        <div className="panel-demo-brand">
          <span className="brand-symbol-tile"><img src="/brand/agenda-profissa-symbol-v2.png" alt="" aria-hidden="true" className="brand-symbol-adaptive" /></span>
          <span className="panel-demo-brand-copy"><b className="brand-wordmark"><span>Agenda</span> <span className="brand-wordmark-accent">Profissa</span></b><small>Seu negócio organizado</small></span>
        </div>
        <PreviewSideNavigation active={active} setActive={setActive} />
        <div className="panel-demo-workspace"><small>Espaço de trabalho</small><b>Studio Aurora</b><span>Dados protegidos na nuvem</span></div>
      </aside>
      <main className="panel-demo-main">
        <PreviewHeader />
        <PreviewContent active={active} activeLabel={activeLabel} />
      </main>
    </div>
  </div>;
}

function MobilePreview({ active, activeLabel, setActive }: { active: PreviewTab; activeLabel: string; setActive: (tab: PreviewTab) => void }) {
  return <div className="hero-mobile-stage panel-demo professional-workspace system-theme" data-preview-tab={active}>
    <div className="hero-mobile-phone">
      <span className="hero-mobile-island" aria-hidden="true"><i /></span>
      <div className="hero-mobile-screen">
        <PreviewHeader />
        <PreviewContent active={active} activeLabel={activeLabel} />
        <nav className="hero-mobile-nav" aria-label="Demonstração das áreas no celular">
          {previewTabs.map((tab) => <button key={tab.id} type="button" className={active === tab.id ? "active" : ""} aria-current={active === tab.id ? "page" : undefined} onClick={() => setActive(tab.id)}><span aria-hidden="true">{tab.icon}</span><small>{tab.label}</small>{active === tab.id && <i aria-hidden="true" />}</button>)}
        </nav>
      </div>
    </div>
  </div>;
}

function PreviewSideNavigation({ active, setActive }: { active: PreviewTab; setActive: (tab: PreviewTab) => void }) {
  return <div className="panel-demo-nav" role="navigation" aria-label="Demonstração das áreas do painel profissional">
    {previewTabs.map((tab) => <button key={tab.id} type="button" className={active === tab.id ? "system-side-nav-active" : ""} aria-label={tab.label} aria-current={active === tab.id ? "page" : undefined} onClick={() => setActive(tab.id)}><span className="panel-demo-nav-icon" aria-hidden="true">{tab.icon}</span><span className="panel-demo-nav-label">{tab.label}</span>{active === tab.id && <i className="preview-menu-click" aria-hidden="true" />}</button>)}
  </div>;
}

function PreviewHeader() {
  return <header className="panel-demo-header"><div><small>Bem-vindo,</small><b>Marina 👋</b></div><div className="panel-demo-header-actions"><span className="panel-demo-notification" aria-hidden="true">✉<i>2</i></span><span className="panel-demo-theme" aria-hidden="true">☼</span><span className="avatar">MC</span></div></header>;
}

function PreviewContent({ active, activeLabel }: { active: PreviewTab; activeLabel: string }) {
  return <div className="panel-demo-content"><div className="panel-demo-breadcrumb"><b>Início</b>{active !== "inicio" && <><span>›</span><em>{activeLabel}</em></>}</div><div key={active} className="preview-page">{renderPreviewPage(active)}</div><div className="preview-cycle" aria-hidden="true"><span key={active} /></div></div>;
}

function renderPreviewPage(active: PreviewTab) {
  if (active === "agenda") return <AgendaPreview />;
  if (active === "clientes") return <ClientsPreview />;
  if (active === "servicos") return <ServicesPreview />;
  return <HomePreview />;
}

function PanelHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: string }) {
  return <div className="panel-demo-heading"><div><p className="eyebrow">{eyebrow}</p><h3 className="title">{title}</h3></div>{action && <button type="button" className="btn btn-primary" aria-label={action}>＋ <span className="panel-demo-action-label">{action}</span></button>}</div>;
}

function HomePreview() {
  return <><PanelHeading eyebrow="Visão geral" title="Seu dia, num relance" action="Novo agendamento"/><div className="panel-demo-stats">{[["Hoje","5","atendimentos"],["Clientes","24","cadastrados"],["Faturamento","R$ 540","previsto no mês"],["Serviços","6","ativos"]].map(([label,value,note])=><PanelStat key={label} label={label} value={value} note={note}/>)}</div><section className="card panel-demo-schedule"><div className="panel-demo-card-heading"><div><p className="eyebrow">Agenda de hoje</p><b>Próximos atendimentos</b></div><span>Ver agenda →</span></div>{appointments.map(([time,name,service,status,color])=><AppointmentRow key={time} time={time} name={name} service={service} status={status} color={color}/>)}</section></>;
}

function AgendaPreview() {
  return <><PanelHeading eyebrow="Organização" title="Agenda" action="Novo agendamento"/><div className="panel-demo-filters"><div className="input panel-demo-search">⌕ <span>Buscar cliente ou serviço</span></div><div className="input panel-demo-date">17/08/2026</div></div><section className="card panel-demo-list">{appointments.map(([time,name,service,status,color])=><AppointmentRow key={time} time={time} name={name} service={service} status={status} color={color}/>)}</section></>;
}

function ClientsPreview() {
  return <><PanelHeading eyebrow="Relacionamento" title="Clientes" action="Novo cliente"/><div className="input panel-demo-search panel-demo-search-wide">⌕ <span>Buscar por nome, telefone ou e-mail</span></div><div className="panel-demo-client-grid">{customers.map(([initials,name,phone,total])=><button type="button" className="card" key={name}><span className="avatar">{initials}</span><span><b>{name}</b><small>{phone}</small><em>{total}</em></span><i>›</i></button>)}</div></>;
}

function ServicesPreview() {
  return <><PanelHeading eyebrow="Catálogo" title="Serviços" action="Novo serviço"/><div className="panel-demo-service-grid">{services.map(([name,duration,price,color])=><button type="button" className="card" key={name}><span className="panel-demo-service-top"><i style={{background:color}}>◇</i><em className="status confirmado">Ativo</em></span><b>{name}</b><span><small>{duration}</small><strong>{price}</strong></span></button>)}</div></>;
}

function PanelStat({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="card panel-demo-stat"><span>◇</span><small>{label}</small><b>{value}</b><em>{note}</em></div>;
}

function AppointmentRow({ time, name, service, status, color }: { time: string; name: string; service: string; status: "confirmado" | "pendente"; color: string }) {
  return <div className="panel-demo-row"><span><b>{time}</b><small>17 ago.</small></span><i style={{background:color}}/><span><b>{name}</b><small>{service} • R$ 65</small></span><em className={`status ${status}`}>{status === "pendente" ? "Pendente" : "Confirmado"}</em></div>;
}
