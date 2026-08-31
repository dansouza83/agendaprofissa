"use client";

import { useEffect, useState } from "react";

const tabs = [
  ["inicio", "⌂", "Início"],
  ["agenda", "▦", "Agenda"],
  ["clientes", "♙", "Clientes"],
  ["servicos", "◇", "Serviços"],
] as const;

type Tab = (typeof tabs)[number][0];

const stages = [
  { device: "web", theme: "dark", label: "WEB • MODO ESCURO", note: "Visão ampla, menu sempre acessível" },
  { device: "web", theme: "light", label: "WEB • MODO CLARO", note: "Leitura confortável em qualquer ambiente" },
  { device: "mobile", theme: "dark", label: "MOBILE • MODO ESCURO", note: "Tudo ao alcance do polegar" },
  { device: "mobile", theme: "light", label: "MOBILE • MODO CLARO", note: "A mesma rotina, perfeitamente adaptada" },
] as const;

export function TourVideoClient() {
  const [stage, setStage] = useState(0);
  const [active, setActive] = useState<Tab>("inicio");
  const current = stages[stage];

  useEffect(() => {
    const stageTimer = window.setInterval(() => setStage((value) => (value + 1) % stages.length), 5200);
    const tabTimer = window.setInterval(() => setActive((value) => {
      const index = tabs.findIndex(([id]) => id === value);
      return tabs[(index + 1) % tabs.length][0];
    }), 1250);
    return () => { window.clearInterval(stageTimer); window.clearInterval(tabTimer); };
  }, []);

  return (
    <main className={`tour-capture tour-${current.theme}`} data-tour-ready="true">
      <div className="tour-ambient" aria-hidden="true" />
      <header className="tour-titlebar">
        <div className="tour-brand"><img src="/brand/agenda-profissa-symbol-v2.png" alt="" style={{ filter: current.theme === "dark" ? "brightness(0) invert(1)" : "none" }} /><span><b>Agenda <em>Profissa</em></b><small>Seu negócio organizado</small></span></div>
        <div className="tour-stage-label"><i />{current.label}</div>
      </header>

      <section key={stage} className={`tour-scene tour-scene-${current.device}`}>
        {current.device === "web" ? <DesktopPanel active={active} dark={current.theme === "dark"} /> : <MobilePanel active={active} />}
        <div className="tour-caption"><span>✓</span><div><b>{current.note}</b><small>Navegação simples. Experiência responsiva.</small></div></div>
      </section>

      <footer className="tour-progress" aria-hidden="true">
        {stages.map((item, index) => <span key={item.label} className={index === stage ? "active" : index < stage ? "done" : ""}><i /></span>)}
      </footer>
    </main>
  );
}

function DesktopPanel({ active, dark }: { active: Tab; dark: boolean }) {
  return <div className="tour-browser"><BrowserTop/><div className="tour-desktop-app"><aside className="tour-side"><MiniBrand dark={dark}/><TourNav active={active}/><div className="tour-workspace"><small>ESPAÇO DE TRABALHO</small><b>Studio Aurora</b><span>Dados protegidos na nuvem</span></div></aside><div className="tour-main"><PanelTop/><PanelContent active={active}/></div></div></div>;
}

function MobilePanel({ active }: { active: Tab }) {
  return <div className="tour-phone"><div className="tour-phone-speaker"/><div className="tour-phone-screen"><PanelTop mobile/><PanelContent active={active} mobile/><nav className="tour-bottom-nav">{tabs.map(([id, icon, label]) => <div key={id} className={active === id ? "active" : ""}><span>{icon}</span><small>{label}</small>{active === id && <i />}</div>)}</nav></div></div>;
}

function BrowserTop() {
  return <div className="tour-browser-top"><span><i/><i/><i/></span><b>app.agendaprofissa.com.br</b><em>—</em></div>;
}

function MiniBrand({ dark }: { dark: boolean }) {
  return <div className="tour-mini-brand"><img src="/brand/agenda-profissa-symbol-v2.png" alt="" style={{ filter: dark ? "brightness(0) invert(1)" : "none" }}/><span><b>Agenda <em>Profissa</em></b><small>Seu negócio organizado</small></span></div>;
}

function TourNav({ active }: { active: Tab }) {
  return <nav className="tour-nav">{tabs.map(([id, icon, label]) => <div key={id} className={active === id ? "active" : ""}><span>{icon}</span><b>{label}</b>{active === id && <i />}</div>)}</nav>;
}

function PanelTop({ mobile = false }: { mobile?: boolean }) {
  return <header className={`tour-panel-top ${mobile ? "mobile" : ""}`}><div><small>Bem-vindo,</small><b>Marina 👋</b></div><div className="tour-panel-actions"><span>✉<i>2</i></span><span>☼</span><b>MC</b></div></header>;
}

function PanelContent({ active, mobile = false }: { active: Tab; mobile?: boolean }) {
  const label = tabs.find(([id]) => id === active)?.[2] ?? "Início";
  return <div key={`${active}-${mobile}`} className={`tour-content ${mobile ? "mobile" : ""}`}><div className="tour-crumb"><b>Início</b>{active !== "inicio" && <><span>›</span><em>{label}</em></>}</div><div className="tour-heading"><div><small>{active === "inicio" ? "VISÃO GERAL" : active === "agenda" ? "ORGANIZAÇÃO" : active === "clientes" ? "RELACIONAMENTO" : "CATÁLOGO"}</small><h1>{active === "inicio" ? "Seu dia, num relance" : label}</h1></div><button>＋ {mobile ? "" : active === "inicio" || active === "agenda" ? "Novo agendamento" : `Novo ${label.slice(0, -1).toLowerCase()}`}</button></div><TourPage active={active} mobile={mobile}/></div>;
}

function TourPage({ active, mobile }: { active: Tab; mobile: boolean }) {
  if (active === "clientes") return <><div className="tour-search">⌕ Buscar por nome, telefone ou e-mail</div><div className="tour-client-grid">{[["AS","Ana Souza"],["BR","Beatriz Ramos"],["CM","Carla Mendes"],["LR","Lucas Rocha"]].slice(0, mobile ? 3 : 4).map(([initials,name], index)=><article key={name}><b>{initials}</b><span><strong>{name}</strong><small>(48) 9990{index}-44{index}1</small><em>{index + 1} atendimentos</em></span><i>›</i></article>)}</div></>;
  if (active === "servicos") return <div className="tour-service-grid">{[["Manicure","R$ 65"],["Sobrancelhas","R$ 55"],["Limpeza de pele","R$ 140"],["Treino funcional","R$ 80"]].slice(0, mobile ? 3 : 4).map(([name,price], index)=><article key={name}><span style={{background:["#e59467","#8a75ba","#56a796","#d08a58"][index]}}>◇</span><em>Ativo</em><b>{name}</b><small>60 minutos <strong>{price}</strong></small></article>)}</div>;
  return <>{active === "inicio" && <div className="tour-stats">{[["Hoje","5"],["Clientes","24"],["Previsto","R$ 540"],["Serviços","6"]].slice(0, mobile ? 2 : 4).map(([label,value])=><article key={label}><small>{label}</small><b>{value}</b></article>)}</div>}{active === "agenda" && <div className="tour-search">⌕ Buscar cliente ou serviço <span>31/08/2026</span></div>}<div className="tour-list"><header><b>{active === "inicio" ? "Próximos horários" : "Agenda do dia"}</b><span>Ver agenda →</span></header>{[["09:00","Ana Paula","Manicure"],["11:00","Beatriz Souza","Sobrancelhas"],["14:30","Carla Mendes","Limpeza de pele"]].map(([time,name,service],index)=><article key={time}><b>{time}</b><i style={{background:["#e59467","#8a75ba","#56a796"][index]}}/><span><strong>{name}</strong><small>{service}</small></span><em>{index === 1 ? "Pendente" : "Confirmado"}</em></article>)}</div></>;
}
