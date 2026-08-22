import { SafeLink as Link } from "../safe-link";
import { LegalPage, legalMetadata } from "../legal-shell";

export const metadata = legalMetadata("Perguntas Frequentes", "Dúvidas frequentes sobre acesso, contas, agenda e privacidade no Agenda Profissa.", "/faq");

const sections = [
  ["Acesso e contas", [
    ["Como entro no sistema?", <>Use o botão <Link href="/sistema">Entrar</Link> e informe e-mail e senha. No ambiente local, estão disponíveis contas de demonstração.</>],
    ["Como crio uma conta profissional?", <>Selecione <Link href="/sistema?cadastro=profissional">Criar perfil profissional</Link>. Esse tipo de conta recebe um espaço próprio para administrar negócio, clientes, serviços e agenda.</>],
    ["Aluno e cliente usam o mesmo perfil do profissional?", "Não. O perfil de aluno/cliente é pessoal e não dá acesso à base administrativa do negócio."],
    ["Esqueci minha senha. E agora?", "Na tela de acesso, selecione “Esqueci minha senha”. No ambiente online, será enviado um link para o e-mail cadastrado."],
  ]],
  ["Agenda e dados", [
    ["Um profissional pode ver dados de outro?", "Não. As regras de autorização são aplicadas no banco de dados e verificam o vínculo com o negócio em cada consulta ou alteração."],
    ["Quais status um agendamento pode ter?", "Pendente, confirmado, concluído ou cancelado."],
    ["Posso usar no celular?", "Sim. A interface é responsiva e a versão online poderá ser instalada na tela inicial como aplicativo web."],
    ["Os dados do modo local vão automaticamente para a nuvem?", "Não. O modo local é uma demonstração no navegador. A migração ou cadastro no ambiente online deve ser planejado antes da publicação."],
  ]],
  ["Privacidade e operação", [
    ["Minha senha é gravada quando mantenho o acesso?", "Não. O aplicativo conserva a sessão autorizada, nunca a senha digitada."],
    ["Posso cadastrar informações de saúde?", "Evite dados sensíveis no campo de observações. Operações que realmente precisem deles exigem avaliação jurídica, base legal e controles adicionais."],
    ["Como funciona a assinatura profissional?", "O profissional escolhe o plano mensal ou anual exibido na página de planos. A cobrança recorrente é processada em reais pelo Mercado Pago, e o painel é liberado após a confirmação."],
    ["O Agenda Profissa guarda os dados do meu cartão?", "Não. O pagamento é processado pelo Mercado Pago; o Agenda Profissa não armazena os dados completos do cartão."],
    ["Um comprovante PIX libera o painel?", <>Não. O acesso só é liberado quando o Mercado Pago confirma o pagamento aprovado. Veja <Link href="/antifraude">Pagamentos e Prevenção a Fraudes</Link>.</>],
    ["Como reconheço uma cobrança oficial?", <>Use somente a contratação iniciada dentro do Agenda Profissa e o ambiente oficial do Mercado Pago. Nunca envie senha ou código de acesso. Veja <Link href="/antifraude">orientações contra golpes</Link>.</>],
    ["Como solicito acesso ou exclusão dos meus dados?", <>Consulte a página <Link href="/direitos-do-titular">Direitos do Titular</Link> e utilize o canal de privacidade indicado após a publicação.</>],
  ]],
] as const;

export default function FaqPage() {
  return <LegalPage eyebrow="Central de ajuda" breadcrumbParent={false} draft={false} title="Perguntas frequentes" description="Respostas rápidas sobre os perfis, o funcionamento da agenda e a proteção dos dados.">{sections.map(([title,items])=><section key={title}><h2>{title}</h2><div className="mt-4 divide-y divide-[#e1e9e4] border-y border-[#e1e9e4]">{items.map(([question,answer])=><details key={question} className="faq-item"><summary>{question}<span>＋</span></summary><p>{answer}</p></details>)}</div></section>)}<div className="mt-10 rounded-2xl bg-[#edf6f1] p-6"><h2 className="!mt-0">Ainda precisa de ajuda?</h2><p>O canal de suporte será divulgado aqui antes da publicação online. Enquanto o projeto estiver em teste local, registre a dúvida com o responsável pelo MVP.</p></div></LegalPage>;
}
