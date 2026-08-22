import { CompanyIdentification, LegalPage, legalMetadata } from "../legal-shell";

export const metadata = legalMetadata("Pagamentos e Prevenção a Fraudes", "Como reconhecer cobranças legítimas e reportar tentativas de golpe no Agenda Profissa.", "/antifraude");

export default function AntiFraudPage() {
  return <LegalPage title="Pagamentos e Prevenção a Fraudes" description="Orientações claras para proteger profissionais, clientes e a plataforma contra cobranças indevidas, engenharia social e falsos comprovantes.">
    <CompanyIdentification />
    <h2>1. Cobranças legítimas</h2>
    <p>A assinatura do Agenda Profissa é destinada exclusivamente ao perfil profissional. Os valores, a periodicidade, a moeda BRL e as condições aplicáveis devem aparecer antes da contratação e no ambiente oficial do Mercado Pago. O Agenda Profissa não solicita senha, código de recuperação, código de autenticação, dados completos de cartão ou transferência para chave PIX de pessoa física por mensagem, ligação ou rede social.</p>
    <h2>2. Confirmação de pagamento</h2>
    <p>O painel profissional somente é liberado quando o Mercado Pago informa ao sistema que o pagamento correto foi aprovado. Um comprovante enviado por mensagem, uma declaração de pagamento ou o clique em “Verificar pagamento” não confirmam pagamento, não substituem a validação do processador e não liberam acesso. Isso reduz o risco de fraude por comprovante falso ou pagamento pendente.</p>
    <h2>3. Sinais de golpe</h2>
    <ul><li>Links, boletos, QR Codes ou chaves PIX enviados fora do fluxo oficial de contratação.</li><li>Pressão para pagar com urgência, alterar chave PIX ou compartilhar códigos de acesso.</li><li>Pedido de instalação de aplicativo, acesso remoto ao dispositivo ou envio de senha.</li><li>Perfil que se apresenta como suporte, mas usa endereço, domínio ou canal diferente do informado nesta página.</li><li>Oferta de desconto, reativação ou liberação manual condicionada a transferência para terceiro.</li></ul>
    <h2>4. O que fazer em caso de suspeita</h2>
    <ol><li>Não pague, não compartilhe dados e não clique em links recebidos fora do ambiente oficial. Nunca envie senha ou código de acesso.</li><li>Altere a senha imediatamente se houver suspeita de acesso indevido e encerre sessões em dispositivos compartilhados.</li><li>Guarde evidências legítimas, como data, endereço do site, identificador da cobrança e capturas de tela.</li><li>Comunique o canal oficial de suporte e, se houver indício de crime, considere registrar ocorrência e contatar sua instituição financeira ou o Mercado Pago.</li></ol>
    <h2>5. Denúncias, análise e medidas</h2>
    <p>O canal oficial de denúncia deverá ser informado na identificação do fornecedor antes da abertura comercial. Relatos devem conter somente dados necessários para a apuração. Poderemos bloquear tentativas suspeitas, preservar registros de segurança, solicitar confirmação de identidade e cooperar com autoridades quando houver dever legal. Medidas de segurança não eliminam direitos do usuário nem afastam obrigações legais do Agenda Profissa.</p>
    <h2>6. Contestação, cancelamento e reembolso</h2>
    <p>Pedidos sobre contratação, cancelamento, arrependimento, cobrança indevida ou reembolso devem ser encaminhados pelo canal oficial do fornecedor. O consumidor mantém os direitos previstos na legislação brasileira, inclusive o direito de arrependimento quando aplicável. Antes da abertura comercial, a operação deve disponibilizar um meio eletrônico eficaz para cancelamento e resposta, confirmar o recebimento da contratação e fornecer uma cópia conservável dos Termos.</p>
    <h2>7. Limites e responsabilidades</h2>
    <p>Esta política não autoriza cobranças fora do fluxo oficial nem transfere ao usuário responsabilidade por falhas atribuíveis ao serviço. O profissional continua responsável pelos serviços que presta a seus próprios clientes, inclusive preços, cancelamentos, comunicações e obrigações de sua atividade. Nada nesta página limita direitos que não possam ser limitados pela legislação brasileira.</p>
  </LegalPage>;
}
