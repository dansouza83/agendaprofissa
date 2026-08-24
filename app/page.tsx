import type { Metadata } from "next";
import { SafeLink as Link } from "./safe-link";
import { PublicFooter, PublicHeader } from "./public-shell";
import { PublicPricing } from "./public-pricing";

export const metadata: Metadata = {
  title: "Agenda Profissa — Sistema de agendamento para profissionais",
  description: "Software de agendamento para esteticistas, salões, personal trainers e profissionais autônomos. Organize agenda, clientes e serviços pelo celular.",
  alternates: { canonical: "/" },
};

const resources = [
  { icon: "▦", title: "Agenda clara", text: "Visualize o dia e altere horários com rapidez." },
  { icon: "♙", title: "Clientes organizados", text: "Contatos e observações reunidos em um só lugar." },
  { icon: "◇", title: "Serviços configurados", text: "Defina duração, valor e disponibilidade." },
  { icon: "⌕", title: "Busca rápida", text: "Encontre clientes, serviços e horários em poucos toques." },
  { icon: "✓", title: "Status visuais", text: "Acompanhe cada atendimento do início à conclusão." },
  { icon: "⌁", title: "Web e celular", text: "Use no navegador ou instale na tela inicial." },
];

const segments = [
  {
    name: "Estética",
    image: "/segments/estetica.png",
    text: "Clínicas, estúdios e profissionais de cuidados faciais e corporais.",
    alt: "Esteticista realizando um cuidado facial em uma cliente",
  },
  {
    name: "Salões e barbearias",
    image: "/segments/saloes.png",
    text: "Cabeleireiros, barbeiros, manicures e equipes de beleza.",
    alt: "Cabeleireira finalizando o cabelo de uma cliente em um salão",
  },
  {
    name: "Personal trainer",
    image: "/segments/personal-trainer.png",
    text: "Treinos individuais, estúdios funcionais e acompanhamento personalizado.",
    alt: "Personal trainer orientando uma cliente durante um exercício",
  },
  {
    name: "Massoterapia",
    image: "/segments/massoterapia.png",
    text: "Sessões de relaxamento, terapias manuais e atendimento recorrente.",
    alt: "Massoterapeuta atendendo uma cliente em cadeira ergonômica",
  },
  {
    name: "Bem-estar",
    image: "/segments/bem-estar.png",
    text: "Yoga, alongamento, práticas integrativas e qualidade de vida.",
    alt: "Profissional de bem-estar orientando uma cliente em um alongamento",
  },
] as const;

const faqs = [
  ["Preciso instalar algum programa?", "Não. O Agenda Profissa funciona no navegador do computador e do celular. Quando publicado, também poderá ser instalado na tela inicial como aplicativo."],
  ["Meus clientes enxergam os dados de outros profissionais?", "Não. A arquitetura separa os dados por negócio e o banco valida a permissão em cada operação. Um usuário só acessa o espaço ao qual está vinculado."],
  ["Qual é a diferença entre perfil profissional e aluno/cliente?", "O profissional administra agenda, serviços e sua carteira de clientes. O aluno ou cliente usa uma área própria para acompanhar os agendamentos vinculados a ele, sem acesso ao painel do negócio."],
  ["Consigo recuperar minha senha?", "Sim. No ambiente online, o usuário solicita um link de recuperação por e-mail e cria uma nova senha com segurança."],
  ["A senha fica salva no aparelho?", "Não. Ao escolher manter o acesso, o sistema conserva somente uma sessão segura; a senha não é armazenada pelo aplicativo."],
  ["Como funciona o pagamento?", "O profissional escolhe a cobrança mensal ou anual pelos valores atualizados exibidos na seção Planos. O pagamento recorrente é processado em reais pelo Mercado Pago e o painel é liberado após a confirmação."],
];

export default function LandingPage() {
  return (
    <div className="landing min-h-screen overflow-hidden bg-[#f8faf7] text-[#17302a]">
      <PublicHeader />
      <main>
        <section id="inicio" className="landing-hero relative isolate scroll-mt-32 border-b border-[#dfe9e3] px-4 py-10 sm:px-6 lg:scroll-mt-24">
          <div className="hero-orb hero-orb-one" aria-hidden="true" />
          <div className="hero-orb hero-orb-two" aria-hidden="true" />
          <div className="landing-hero-grid relative mx-auto grid min-w-0 max-w-7xl items-center gap-10 lg:grid-cols-[.92fr_1.08fr]">
            <div className="landing-hero-copy min-w-0 max-w-2xl">
              <span className="hero-badge inline-flex items-center gap-2 rounded-full border border-[#c9ded5] bg-white/80 px-3 py-2 text-xs font-extrabold uppercase tracking-[.14em] text-[#2f7d70] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#e59467]" /> Feito para profissionais que cuidam de pessoas
              </span>
              <h1 className="landing-hero-title mt-5 text-4xl font-black leading-[1.02] tracking-[-.055em] text-[#153a32] sm:text-6xl">
                Sua rotina organizada. Seu atendimento mais humano.
              </h1>
              <p className="landing-hero-description mt-5 max-w-xl text-lg leading-8 text-[#5d7069]">
                Agenda, clientes e serviços reunidos em uma experiência simples para esteticistas, cabeleireiros, personal trainers e profissionais autônomos.
              </p>
              <div className="landing-hero-actions mt-6 flex flex-col gap-3 sm:flex-row">
                <Link className="landing-button landing-button-primary" href="/sistema?cadastro=profissional">Criar perfil profissional <span>→</span></Link>
                <Link className="landing-button landing-button-secondary" href="/sistema?cadastro=cliente">Sou aluno ou cliente</Link>
              </div>
              <div className="landing-hero-benefits mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-[#60726c]">
                <span>✓ Acesso pelo celular</span><span>✓ Planos mensal e anual</span><span>✓ Dados separados por negócio</span>
              </div>
            </div>

            <DashboardPreview />
          </div>
        </section>

        <section className="landing-trust border-b border-[#e4ece7] bg-white px-4 py-7 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 text-center md:flex-row md:text-left">
            <p className="max-w-md text-sm font-semibold leading-6 text-[#5c6e68]">Uma única plataforma para negócios de beleza, bem-estar, saúde e treinamento.</p>
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-extrabold text-[#31584f]"><span>Estética</span><span>Salões</span><span>Personal</span><span>Massoterapia</span><span>Bem-estar</span></div>
          </div>
        </section>

        <section id="segmentos" className="landing-segments scroll-mt-32 px-4 py-20 sm:px-6 lg:scroll-mt-24 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionIntro eyebrow="Feito para o seu segmento" title="Uma agenda que entende diferentes formas de cuidar." text="Do primeiro contato ao atendimento concluído, o Agenda Profissa se adapta à rotina de profissionais de beleza, movimento e bem-estar." />
            <div className="segment-grid mt-12" aria-label="Segmentos atendidos pela plataforma">
              {segments.map((segment, index) => (
                <article key={segment.name} className={`segment-card segment-card-${index + 1}`}>
                  {/* Imagens locais e estáticas; o elemento nativo evita dependência do otimizador no MVP local. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={segment.image}
                    alt={segment.alt}
                    width="1536"
                    height="1152"
                    loading="lazy"
                    decoding="async"
                    className="segment-image"
                  />
                  <div className="segment-shade" aria-hidden="true" />
                  <div className="segment-content">
                    <span>Para quem atende</span>
                    <h3>{segment.name}</h3>
                    <p>{segment.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="recursos" className="scroll-mt-32 px-4 py-20 sm:px-6 lg:scroll-mt-24 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionIntro eyebrow="Tudo no lugar" title="Menos tempo organizando. Mais tempo atendendo." text="Recursos essenciais para uma rotina profissional, sem excesso de telas ou complicação." />
            <div className="resource-grid mt-10">
              {resources.map((item) => <article key={item.title} className="feature-card"><div className="feature-card-heading"><span className="feature-icon">{item.icon}</span><h3>{item.title}</h3></div><p>{item.text}</p></article>)}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-32 bg-[#183f37] px-4 py-20 text-white sm:px-6 lg:scroll-mt-24 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionIntro light eyebrow="Comece com simplicidade" title="Do cadastro ao atendimento em três passos." text="Você configura o espaço uma vez e passa a conduzir a rotina por uma agenda clara." />
            <div className="steps-grid mt-10">
              {[
                ["01", "Crie seu espaço", "Informe seus dados e dê um nome ao negócio."],
                ["02", "Cadastre o essencial", "Adicione clientes, serviços, duração e valores."],
                ["03", "Organize a agenda", "Crie horários, atualize status e acompanhe o dia."],
              ].map(([number,title,text]) => <article key={number} className="step-card"><div className="step-card-heading"><span className="step-number">{number}</span><h3>{title}</h3></div><p>{text}</p></article>)}
            </div>
          </div>
        </section>

        <section id="para-quem" className="scroll-mt-32 px-4 py-20 sm:px-6 lg:scroll-mt-24 lg:py-28">
          <div className="audience-grid mx-auto max-w-7xl">
            <article className="audience-card audience-professional">
              <span className="audience-badge">Profissionais e negócios</span>
              <h2>Seu negócio sob controle.</h2>
              <p>Gerencie agenda, clientes e serviços em um espaço próprio e protegido.</p>
              <ul><li>Agenda e indicadores</li><li>Clientes e histórico</li><li>Equipe e permissões</li></ul>
              <Link href="/sistema?cadastro=profissional">Criar perfil profissional →</Link>
            </article>
            <article className="audience-card audience-client">
              <span className="audience-badge">Alunos e clientes</span>
              <h2>Seus horários, sem confusão.</h2>
              <p>Acompanhe seus atendimentos em uma conta pessoal e segura.</p>
              <ul><li>Perfil pessoal separado</li><li>Próprios agendamentos</li><li>Acesso e recuperação seguros</li></ul>
              <Link href="/sistema?cadastro=cliente">Criar perfil de aluno/cliente →</Link>
            </article>
          </div>
        </section>

        <section id="planos" className="landing-pricing scroll-mt-32 border-y border-[#dfe9e3] bg-white px-4 py-20 sm:px-6 lg:scroll-mt-24 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <SectionIntro centered eyebrow="Planos para profissionais" title="Invista na organização que acompanha o seu negócio todos os dias." text="Os dois planos liberam o painel profissional completo. Escolha a flexibilidade do pagamento mensal ou a economia e a previsibilidade do plano anual." />
            <PublicPricing />
            <div className="pricing-assurance mx-auto mt-8 max-w-5xl">
              <span aria-hidden="true">✓</span>
              <p><strong>Liberação após confirmação.</strong> O pagamento é processado pelo Mercado Pago. O Agenda Profissa não armazena os dados do seu cartão.</p>
            </div>
          </div>
        </section>

        <section id="seguranca" className="landing-security scroll-mt-32 border-y border-[#dfe9e3] bg-white px-4 py-20 sm:px-6 lg:scroll-mt-24 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <div className="security-mark" aria-hidden="true"><span>✓</span><div><b>Privacidade desde a base</b><small>Arquitetura multitenant</small></div></div>
            <div><p className="section-eyebrow">Segurança e privacidade</p><h2 className="section-title max-w-3xl">Cada negócio no seu espaço. Cada pessoa no seu nível de acesso.</h2><p className="mt-5 max-w-2xl text-lg leading-8 text-[#63736e]">O banco de dados aplica regras por negócio em cada leitura e alteração. A autenticação, a recuperação de senha e o armazenamento de sessão foram planejados para a publicação online.</p><div className="mt-7 flex flex-wrap gap-3"><Link className="text-link-chip" href="/seguranca">Conhecer as medidas</Link><Link className="text-link-chip" href="/privacidade">Ler a privacidade</Link><Link className="text-link-chip" href="/direitos-do-titular">Seus direitos</Link></div></div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-32 px-4 py-20 sm:px-6 lg:scroll-mt-24 lg:py-28">
          <div className="mx-auto max-w-4xl">
            <SectionIntro centered eyebrow="Perguntas frequentes" title="Dúvidas comuns, respostas diretas." text="Entenda como o sistema funciona antes de criar sua conta." />
            <div className="mt-10 divide-y divide-[#dfe8e3] border-y border-[#dfe8e3]">
              {faqs.map(([question,answer]) => <details key={question} className="faq-item"><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}
            </div>
            <div className="mt-8 text-center"><Link className="font-extrabold text-[#2f7d70]" href="/faq">Ver todas as perguntas →</Link></div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:pb-28">
          <div className="landing-cta relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#e9a878] px-6 py-14 text-center text-[#18362f] sm:px-10 lg:py-20">
            <div className="absolute -right-16 -top-20 h-60 w-60 rounded-full border-[40px] border-white/15" aria-hidden="true" />
            <p className="text-xs font-black uppercase tracking-[.18em]">Sua agenda pode ser mais leve</p>
            <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-[-.04em] sm:text-5xl">Comece a organizar hoje o negócio que você quer construir.</h2>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link className="landing-button bg-[#173f37] text-white hover:bg-[#102e28]" href="/sistema?cadastro=profissional">Criar conta profissional</Link><Link className="landing-button border border-[#704c35]/20 bg-white/75 text-[#18362f] hover:bg-white" href="/sistema">Já tenho uma conta</Link></div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function SectionIntro({ eyebrow, title, text, centered = false, light = false }: { eyebrow: string; title: string; text: string; centered?: boolean; light?: boolean }) {
  return <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}><p className={`section-eyebrow ${light ? "!text-[#9dd4c4]" : ""}`}>{eyebrow}</p><h2 className={`section-title ${light ? "!text-white" : ""}`}>{title}</h2><p className={`mt-5 text-lg leading-8 ${light ? "text-[#c4dad3]" : "text-[#64756f]"}`}>{text}</p></div>;
}

function DashboardPreview() {
  return (
    <div className="relative mx-auto min-w-0 w-full max-w-2xl lg:mx-0">
      <div className="preview-window">
        <div className="preview-top"><div className="flex gap-1.5"><i /><i /><i /></div><span>app.agendaprofissa.com.br</span><b>•••</b></div>
        <div className="grid min-h-[420px] min-w-0 grid-cols-[72px_minmax(0,1fr)] sm:grid-cols-[150px_minmax(0,1fr)]">
          <aside className="preview-side"><div className="preview-logo">✦</div>{["⌂ Início","▦ Agenda","♙ Clientes","◇ Serviços"].map((item,index)=><div key={item} className={index===0?"active":""}>{item}</div>)}</aside>
          <div className="min-w-0 bg-[#f7f9f6] p-4 sm:p-6">
            <div className="flex items-center justify-between"><div><small>SEGUNDA, 17 DE AGOSTO</small><h3>Bom dia, Marina.</h3></div><span className="preview-avatar">MC</span></div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3"><PreviewStat value="5" label="Hoje"/><PreviewStat value="24" label="Clientes"/><div className="hidden sm:block"><PreviewStat value="R$ 540" label="Previsto"/></div></div>
            <div className="mt-4 rounded-2xl border border-[#e1e8e4] bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><b className="text-sm">Próximos horários</b><span className="text-xs font-bold text-[#2f7d70]">Ver agenda</span></div>{[["09:00","Ana Paula","Manicure"],["11:00","Beatriz Souza","Sobrancelhas"],["14:30","Carla Mendes","Limpeza de pele"]].map(([time,name,service],index)=><div key={time} className="preview-row"><b>{time}</b><i style={{background:["#e59467","#8a75ba","#56a796"][index]}}/><span><strong>{name}</strong><small>{service}</small></span><em>{index===1?"Pendente":"Confirmado"}</em></div>)}</div>
          </div>
        </div>
      </div>
      <div className="preview-float"><span>✓</span><div><b>Dados separados</b><small>por negócio e usuário</small></div></div>
    </div>
  );
}

function PreviewStat({ value, label }: { value: string; label: string }) { return <div className="rounded-xl border border-[#e4eae6] bg-white p-3"><small>{label}</small><b className="mt-2 block text-lg">{value}</b></div>; }
