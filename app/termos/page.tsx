import { CompanyIdentification, LegalPage, legalMetadata } from "../legal-shell";

export const metadata = legalMetadata("Termos de Uso", "Regras para acesso e utilização do Agenda Profissa.", "/termos");

export default function TermsPage() {
  return <LegalPage title="Termos de Uso" description="Regras que organizam a relação entre o Agenda Profissa, profissionais, negócios, alunos e clientes.">
    <CompanyIdentification />
    <h2>1. Aceitação e escopo</h2>
    <p>Ao criar uma conta, acessar ou utilizar o Agenda Profissa, você declara que leu e concorda com estes Termos e com o Aviso de Privacidade. Se estiver agindo em nome de uma empresa, declara possuir poderes para vinculá-la.</p>
    <p>O Agenda Profissa é uma ferramenta de organização de clientes, serviços e agendamentos. O sistema não presta o serviço profissional anunciado nem supervisiona a execução do atendimento. A assinatura paga descrita abaixo remunera somente o acesso do profissional à plataforma.</p>
    <h2>2. Elegibilidade e contas</h2>
    <ul>
      <li>O cadastro independente é destinado a pessoas com 18 anos ou mais e capacidade legal.</li>
      <li>Menores somente poderão usar funcionalidades futuras apropriadas por intermédio e sob responsabilidade de seu representante legal.</li>
      <li>Os dados de cadastro devem ser verdadeiros, completos e atualizados.</li>
      <li>A conta é pessoal. O titular deve proteger a senha e comunicar imediatamente qualquer acesso suspeito.</li>
      <li>O usuário responde pelas ações realizadas em sua conta, salvo falha comprovadamente atribuível ao serviço ou hipótese protegida pela legislação aplicável.</li>
    </ul>
    <h2>3. Perfis e responsabilidades</h2>
    <h3>Perfil profissional ou negócio</h3>
    <p>O profissional é responsável pela legalidade, qualidade, licenças, preços, horários, informações e execução dos serviços que oferece; pela base legal para cadastrar dados de seus clientes; e pela configuração de cancelamentos, confirmações e comunicações.</p>
    <h3>Perfil de aluno ou cliente</h3>
    <p>O aluno ou cliente é responsável por manter seus dados corretos, comparecer aos horários combinados e observar as regras informadas pelo profissional. Divergências sobre o atendimento devem ser tratadas diretamente com o respectivo profissional, sem prejuízo dos direitos previstos em lei.</p>
    <h2>4. Uso permitido</h2>
    <p>É permitido usar o sistema para finalidades legítimas de gestão e acompanhamento de atendimentos. É proibido violar leis, direitos de terceiros, privacidade, propriedade intelectual ou as Diretrizes de Uso.</p>
    <h2>5. Agendamentos e cancelamentos de atendimentos</h2>
    <p>O agendamento registrado é uma informação operacional entre o profissional e seu cliente. O profissional define disponibilidade, tolerância, remarcação e cancelamento, respeitando o Código de Defesa do Consumidor e outras normas aplicáveis.</p>
    <h2>6. Assinatura profissional e pagamento</h2>
    <ul>
      <li><strong>Mensal:</strong> cobrança recorrente mensal pelo valor apresentado na página de planos e no momento da contratação.</li>
      <li><strong>Anual:</strong> cobrança recorrente a cada 12 meses pelo valor apresentado na página de planos e no momento da contratação.</li>
      <li>Os valores são sempre cobrados em reais (BRL) pelo Mercado Pago.</li>
      <li>Os dois planos liberam os mesmos recursos do painel profissional após a confirmação do pagamento.</li>
      <li>Os dados completos do cartão não são armazenados pelo Agenda Profissa.</li>
    </ul>
    <p>Antes de confirmar, o usuário verá o plano, o valor, a periodicidade e as condições aplicáveis no ambiente do Mercado Pago. A renovação seguirá a periodicidade escolhida até o cancelamento. Solicitações de cancelamento, arrependimento ou reembolso serão analisadas conforme a legislação brasileira e as condições informadas no momento da contratação, sem prejuízo de direitos legalmente assegurados.</p>
    <p>O painel não é liberado por comprovante enviado ao suporte, declaração do usuário ou confirmação manual. A liberação depende de confirmação de pagamento aprovado pelo Mercado Pago, vinculada à assinatura, ao valor contratado e à moeda BRL. Esse controle busca evitar fraude por comprovante falso, pagamento pendente ou cobrança direcionada a terceiros.</p>
    <p>Falha, recusa, estorno, expiração ou cancelamento da cobrança pode impedir ou suspender o acesso aos recursos profissionais, preservadas as obrigações legais relativas aos dados da conta.</p>
    <h3>Direito de arrependimento, cancelamento e reembolso</h3>
    <p>Quando a contratação estiver sujeita ao Código de Defesa do Consumidor, o direito de arrependimento será respeitado nos termos da lei. O consumidor não perde direitos por esta cláusula. Antes da abertura comercial, o Agenda Profissa deverá disponibilizar meio eletrônico eficaz para cancelamento, reclamação e solicitação de reembolso; confirmar o recebimento da contratação; e disponibilizar cópia destes Termos em formato que possa ser guardado e reproduzido.</p>
    <p>Não haverá taxa, despesa adicional ou restrição de uso não exibida de forma clara antes da contratação. Mudanças de preço, renovação ou condições serão comunicadas antes de afetarem a próxima cobrança, na forma exigida pela lei e pelos meios de pagamento utilizados.</p>
    <h2>7. Disponibilidade e mudanças</h2>
    <p>Buscamos manter o serviço disponível e seguro, mas podem ocorrer manutenções, atualizações, indisponibilidades de terceiros ou eventos fora de controle razoável. Funcionalidades podem evoluir, desde que direitos adquiridos e deveres legais sejam respeitados.</p>
    <h2>8. Suspensão e encerramento</h2>
    <p>Podemos limitar ou suspender contas diante de risco de segurança, fraude, ordem legal, inadimplência ou violação material destes Termos, com informação e oportunidade de esclarecimento quando isso for possível e adequado. O usuário pode solicitar o encerramento da conta e a eliminação de dados, observadas retenções legais e direitos de terceiros.</p>
    <h2>9. Propriedade intelectual</h2>
    <p>A marca, o software, o desenho da interface e os materiais do Agenda Profissa pertencem a seus respectivos titulares. O usuário recebe uma licença limitada, revogável, não exclusiva e intransferível para usar o serviço durante a vigência da conta. Os dados inseridos permanecem de seus legítimos titulares.</p>
    <h2>10. Serviços de terceiros</h2>
    <p>O serviço depende de infraestrutura, autenticação, hospedagem, e-mail e processamento de pagamentos de fornecedores especializados, incluindo o Mercado Pago. Links ou integrações de terceiros são regidos também pelos termos desses fornecedores, quando aplicável.</p>
    <h2>11. Responsabilidade</h2>
    <p>Nenhuma cláusula exclui responsabilidade que não possa ser afastada pela legislação brasileira, inclusive direitos do consumidor e obrigações de proteção de dados. Na extensão permitida por lei, o Agenda Profissa não responde pela execução dos serviços do profissional, informações inseridas pelos usuários ou perdas causadas por uso indevido da conta.</p>
    <h2>12. Privacidade</h2>
    <p>O tratamento de dados pessoais é descrito no Aviso de Privacidade. Na relação com dados de clientes cadastrados pelo profissional, os papéis de controlador e operador são explicados naquele documento.</p>
    <h2>13. Alterações destes Termos e dos planos</h2>
    <p>Mudanças relevantes serão informadas de maneira apropriada antes de entrarem em vigor. Alterações de preço ou periodicidade observarão a legislação aplicável e serão comunicadas antes de afetarem uma renovação. A versão aplicável e a data de atualização permanecerão disponíveis nesta página.</p>
    <h2>14. Lei aplicável e conflitos</h2>
    <p>Aplica-se a legislação brasileira. Fica preservado ao consumidor o direito de recorrer ao foro de seu domicílio e aos órgãos competentes. Antes de uma demanda, incentivamos o contato pelo canal de suporte para tentativa de solução.</p>
  </LegalPage>;
}
